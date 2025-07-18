import logging
import json
import base64
import asyncio
import websockets
from datetime import datetime
from collections import deque
from io import BytesIO
from prompt_toolkit import Application
from prompt_toolkit.buffer import Buffer
from prompt_toolkit.layout.containers import VSplit, Window, HSplit, FloatContainer, Float
from prompt_toolkit.layout.controls import BufferControl, FormattedTextControl
from prompt_toolkit.layout.layout import Layout
from prompt_toolkit.key_binding import KeyBindings, KeyPressEvent
from prompt_toolkit.layout.dimension import Dimension as D
from prompt_toolkit.layout.menus import CompletionsMenu
from prompt_toolkit.styles import Style

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import TypedDict, Literal

    type SingleMessageType = Literal["text", "image", "file"]

    class SingleMessage(TypedDict):
        nickname: str
        type: SingleMessageType
        message: str

    class ListMessage(TypedDict):
        nickname: str
        type: Literal["list"]
        message: list[tuple[SingleMessageType, str]]

    type Message = SingleMessage | ListMessage


class ConsoleServer:
    def quit_console(self, event: KeyPressEvent):
        event.app.exit()

    def press_enter(self, event: KeyPressEvent):
        message = self.input_buffer.text.strip()
        self.input_buffer.reset()
        if not message:
            self.print_message("system", "不能发送空消息。")
        else:
            asyncio.create_task(self.message_queue.put(message))

    def __init__(self, port: int, nickname: str):

        self.port = port
        self.nickname = nickname
        self.messages: deque[tuple[str, str, int]] = deque(maxlen=1000)
        # 这里处理输入的消息
        self.message_queue: asyncio.Queue[str] = asyncio.Queue()
        self.current_message: str = ""
        self.ws_connections: set[int] = set()
        self.message_update_flag: bool = False
        self.message_update_event = asyncio.Event()
        self.input_buffer = Buffer()
        # 样式定义
        self.style = Style.from_dict(
            {
                "output-area": "#ffffff bg:#2b2b2b",
                "input-area": "bg:#333333 #ffffff",
                "toolbar": "bg:#444444 #ffffff",
                "prompt": "#00ff00 italic",
                "self": "#00CC33",
                "other": "#FFCC33",
                "system": "#3399FF italic",
                "link": "#3399FF italic underline",
                "white": "#FFFFFF",
                "warning": "#FF9900",
                "error": "#FF0000",
            }
        )
        key_bindings = KeyBindings()
        key_bindings.add("enter")(self.press_enter)
        key_bindings.add("c-c", eager=True)(self.quit_console)
        key_bindings.add("c-q", eager=True)(self.quit_console)

        # 布局定义
        self.output_field = FormattedTextControl(text=self.formatted_messages, focusable=False)
        self.output_window = Window(content=self.output_field, height=D(min=1), style="class:output-area", wrap_lines=True)
        self.input_field = BufferControl(buffer=self.input_buffer)
        self.layout = Layout(
            FloatContainer(
                HSplit(
                    [
                        self.output_window,
                        Window(height=1, char="-", style="class:toolbar"),
                        VSplit(
                            [
                                Window(width=D.exact(2), content=FormattedTextControl([("class:prompt", "> ")]), style="class:input-area"),
                                Window(content=self.input_field, height=D.exact(3), style="class:input-area"),
                            ]
                        ),
                        Window(
                            height=D.exact(1),
                            content=FormattedTextControl(text="按 Ctrl-C / Ctrl-Q 退出，Enter 发送。"),
                            style="class:toolbar",
                        ),
                    ]
                ),
                [Float(xcursor=True, ycursor=True, content=CompletionsMenu(max_height=16, scroll_offset=1))],
            )
        )

        self.application = Application(
            layout=self.layout,
            key_bindings=key_bindings,
            full_screen=True,
            mouse_support=True,
            style=self.style,
        )

    def print_message(self, role: str, message: str, end: str = "\n"):
        message = message + end
        self.messages.appendleft((role, message, message.count("\n")))
        if self.application.is_running:
            self.application.invalidate()

    def formatted_messages(self):
        # 获取当前 Application 实例
        if render_info := self.output_window.render_info:
            window_height = render_info.window_height
            messages = []
            totle_line_count = 0
            for msg_type, msg_text, line_count in self.messages:
                totle_line_count += line_count
                if totle_line_count > window_height:
                    break
                messages.append((f"class:{msg_type}", msg_text))
            messages.reverse()
            return messages
        else:
            return []

    async def input(self, websocket: websockets.ServerConnection) -> str:
        """获取服务器输入

        这个方法用于获取服务器的输入消息。它的逻辑如下：

        - **对于首次连接的客户端：**
          如果当前 WebSocket 连接 (`websocket`) 不在 `ws_connections`（表示它还没有获取当前消息），它会立即返回 `current_message` 并将该连接添加到 `ws_connections` 中，标记为已获取。

        - **对于已连接的客户端：**
          如果连接已经在 `ws_connections` 中（表示它已经获取过当前消息），它会从 `message_queue` 中等待并获取新的服务器输入，然后更新 `current_message`。
          一旦 `current_message` 被更新，所有已获取过消息的连接记录（即 `ws_connections`）都会被清除，以便它们可以重新获取最新的消息。

        - **消息更新标志 (`message_update_flag`) 的作用：**
          当一个协程正在从 `message_queue` 等待新消息时，`message_update_flag` 会被设置为 `True`。
          这会阻止其他协程也去 `message_queue` 中等待。相反，它们会等待 `message_update_event` 被设置，直到 `current_message` 更新完毕后直接获取更新后的消息。
        """
        websocket_hash = hash(websocket)
        if websocket_hash in self.ws_connections:
            if self.message_update_flag:
                await self.message_update_event.wait()
            else:
                self.message_update_flag = True
                self.message_update_event.clear()
                self.current_message = await self.message_queue.get()
                self.ws_connections.clear()
                self.message_update_flag = False
                self.message_update_event.set()
        self.ws_connections.add(websocket_hash)
        return self.current_message

    async def send_message(self, websocket: websockets.ServerConnection):
        while True:
            message = await self.input(websocket)
            if not message:
                continue
            try:
                await websocket.send(message)
                self.print_message("prompt", f"{self.nickname}[{datetime.now().strftime("%H:%M:%S")}]")
                self.print_message("self", message)
            except websockets.exceptions.ConnectionClosedOK:
                self.print_message("system", "错误：连接已关闭，无法发送消息。")
            except Exception as e:
                self.print_message("system", f"错误：发送消息时出错：{e}")

    def print_type(self, message_type: SingleMessageType, message: str, end: str = "\n"):
        match message_type:
            case "at":
                self.print_message("link", f"@{message} ", end)
            case "text":
                self.print_message("other", message, end)
            case "image":
                self.print_message("link", f"[图片]", end)
                from PIL import Image

                Image.open(BytesIO(base64.b64decode(message))).show()

    async def receive_message(self, websocket: websockets.ServerConnection):
        while True:
            try:
                recv = await websocket.recv()
                message: Message = json.loads(recv)
                self.print_message("prompt", f"{message["nickname"]}[{datetime.now().strftime("%H:%M:%S")}]")
                if message["type"] == "list":
                    for msg_type, msg in message["message"][:-1]:
                        self.print_type(msg_type, msg, "")
                    self.print_type(*message["message"][-1])
                else:
                    self.print_type(message["type"], message["message"])
            except websockets.exceptions.PayloadTooBig:
                self.print_message("warning", "接收到的消息过大，已忽略。")
            except json.JSONDecodeError:
                self.print_message("warning", f"接收到的消息无法解析为JSON：{recv}")

    async def handler(self, websocket: websockets.ServerConnection):
        self.ws_connections.add(hash(websocket))
        host, port = websocket.remote_address
        self.print_message("system", f"客户端 {host}:{port} 已连接。")
        try:
            await asyncio.gather(self.receive_message(websocket), self.send_message(websocket))
        except websockets.exceptions.ConnectionClosedError:
            self.print_message("system", f"与 {host}:{port} 通信被拒绝，客户端可能已关闭。")
        except Exception as e:
            self.print_message("system", f"接收消息时发生错误: \n{e}")

    async def run_server(self):
        server = await websockets.serve(self.handler, "127.0.0.1", self.port, max_size=10 * 2**20)
        await server.serve_forever()
        await server.wait_closed()

    async def run(self):
        await asyncio.gather(
            self.application.run_async(),
            self.run_server(),
        )


class ConsoleServerLogHandler(logging.Handler):
    def __init__(self, console: ConsoleServer):
        super().__init__()
        self.console = console

    def emit(self, record):
        if record.levelno >= logging.ERROR:
            self.console.print_message("error", self.format(record))
        elif record.levelno >= logging.WARNING:
            self.console.print_message("warning", self.format(record))
        else:
            self.console.print_message("system", self.format(record))


if __name__ == "__main__":
    import sys
    import logging
    import asyncio

    _, port, nickname = sys.argv
    server = ConsoleServer(port=int(port), nickname=nickname)
    handler = ConsoleServerLogHandler(server)
    logging.basicConfig(handlers=[handler], level=logging.WARNING)
    asyncio.run(server.run())
