SCRIPT_PATH = __file__

if __name__ == "__main__":
    import sys
    import logging
    import json
    import base64
    import asyncio
    import websockets
    from datetime import datetime
    from collections import deque
    from io import BytesIO
    from PIL import Image

    from prompt_toolkit import Application
    from prompt_toolkit.buffer import Buffer
    from prompt_toolkit.layout.containers import VSplit, Window, HSplit, FloatContainer, Float
    from prompt_toolkit.layout.controls import BufferControl, FormattedTextControl
    from prompt_toolkit.layout.layout import Layout
    from prompt_toolkit.key_binding import KeyBindings, KeyPressEvent
    from prompt_toolkit.layout.dimension import Dimension as D
    from prompt_toolkit.layout.menus import CompletionsMenu
    from prompt_toolkit.styles import Style

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
            asyncio.create_task(self.broadcast_message(message))

        def __init__(self, port: int, nickname: str):

            self.port = port
            self.nickname = nickname
            self.messages: deque[tuple[str, str, int]] = deque(maxlen=1000)
            self.clients: set[websockets.ServerConnection] = set()
            self.input_buffer = Buffer()
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
                                    Window(
                                        width=D.exact(2), content=FormattedTextControl([("class:prompt", "> ")]), style="class:input-area"
                                    ),
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

            self.log_handler = self.LogHandler(self)

        class LogHandler(logging.Handler):
            def __init__(self, console: "ConsoleServer"):
                super().__init__()
                self.console = console

            def emit(self, record):
                if record.levelno >= logging.ERROR:
                    self.console.print_message("error", self.format(record))
                elif record.levelno >= logging.WARNING:
                    self.console.print_message("warning", self.format(record))
                else:
                    self.console.print_message("system", self.format(record))

        def print_message(self, role: str, message: str, end: str = "\n"):
            message = message + end
            self.messages.appendleft((role, message, message.count("\n")))
            if self.application.is_running:
                self.application.invalidate()

        def print_type(self, message_type: SingleMessageType, message: str, end: str = "\n"):
            match message_type:
                case "at":
                    self.print_message("link", f"@{message}", end)
                case "text":
                    self.print_message("other", message, end)
                case "image":
                    self.print_message("link", f"[图片]", end)
                    Image.open(BytesIO(base64.b64decode(message))).show()

        def formatted_messages(self) -> list[tuple[str, str]]:
            render_info = self.output_window.render_info
            if render_info is None or (window_width := render_info.window_width - 1) <= 0:
                return []
            window_height = render_info.window_height
            messages = []
            totle_line_height = 0
            nowrapline_width = 0
            for msg_type, msg_text, line_height in self.messages:
                if line_height == 0:
                    nowrapline_width += len(msg_text)
                    if nowrapline_width >= window_width:
                        totle_line_height += nowrapline_width // window_width
                        nowrapline_width = nowrapline_width % window_width
                else:
                    if nowrapline_width:
                        totle_line_height += 1
                    *seglist, last_seg = msg_text.split("\n")
                    totle_line_height += sum((len(seg) + window_width - 1) // window_width for seg in seglist)
                    nowrapline_width = len(last_seg)
                if totle_line_height >= window_height:
                    break
                messages.append((f"class:{msg_type}", msg_text))
            messages.reverse()
            return messages

        async def broadcast_message(self, message: str):
            if not message:
                self.print_message("system", "不能发送空消息。")
            else:
                self.print_message("prompt", f"{self.nickname}[{datetime.now().strftime("%H:%M:%S")}]")
                self.print_message("self", message)
                await asyncio.gather(*(asyncio.create_task(self.send_message(client, message)) for client in self.clients))

        async def send_message(self, client: websockets.ServerConnection, message: str):
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosedOK:
                host, port = client.remote_address
                self.print_message("system", f"客户端 {host}:{port} 连接已关闭，无法发送消息。")
            except Exception as e:
                self.print_message("system", f"错误：发送消息时出错：{e}")

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

        async def websocket_handler(self, client: websockets.ServerConnection):
            host, port = client.remote_address
            self.clients.add(client)
            self.print_message("system", f"客户端 {host}:{port} 已连接。")
            try:
                await self.receive_message(client)
            except websockets.exceptions.ConnectionClosedError:
                self.print_message("system", f"与 {host}:{port} 通信被拒绝，客户端可能已关闭。")
            except Exception as e:
                self.print_message("system", f"接收消息时发生错误: \n{e}")
            self.clients.remove(client)
            self.print_message("system", f"客户端 {host}:{port} 的连接已断开。")

        async def run(self):
            server = await websockets.serve(self.websocket_handler, "127.0.0.1", self.port, max_size=10 * 2**20)
            await asyncio.gather(
                self.application.run_async(),
                server.serve_forever(),
            )

    _, port, nickname = sys.argv
    server = ConsoleServer(port=int(port), nickname=nickname)
    logging.basicConfig(handlers=[server.log_handler], level=logging.WARNING)
    asyncio.run(server.run())
