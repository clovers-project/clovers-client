import json
import asyncio
from pathlib import Path
from functools import partial
from collections import deque
from fastapi import FastAPI, File, UploadFile, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, FileResponse
from clovers import CloversCore
from clovers.logger import logger
from clovers_client.logger import init_logger
from clovers_client.utils import id_generator
from .utils import upload
from typing import cast
from .protocol import GroupInfo, ConsoleMessage, Message, MessageEvent
from .config import Config

CONSOLE_PREFIX = b"\x05\x03\x01".decode()
PAGE_RESOURCE = Path(__file__).parent / "page"


def load_groups(file: str) -> dict[str, GroupInfo]:
    f = Path(file)
    if not f.exists():
        return {}
    try:
        with f.open("r") as f:
            groups = json.load(f)
        if not isinstance(groups, list):
            return {}

        def valid_g(g: dict) -> bool:
            for k in ("groupName", "groupId", "groupAvatar"):
                if k not in g:
                    return False
                if not g[k]:
                    continue
                if not isinstance(g[k], str):
                    return False
            return True

        return {g["groupId"]: g for g in groups if valid_g(g)}
    except Exception:
        return {}


class ConsoleClient(CloversCore):
    def __init__(self, config: Config = Config.sync_config("clovers")):
        super().__init__("CONSOLE")
        init_logger(logger, log_file=config.LOG_FILE, log_level=config.LOG_LEVEL)
        from .adapter import ADAPTER

        self.adapter.mixin(ADAPTER)
        # 初始化加载
        self.load_adapter(config.adapters, config.adapter_dirs)
        self.load_plugin(config.plugins, config.plugin_dirs)
        # inner
        self.BOT_NICKNAME = config.BOT_NICKNAME
        self.BOT_AVATAR_URL = config.BOT_AVATAR_URL
        self._length_bot_nickname = len(self.BOT_NICKNAME)
        # FastAPI
        self.host = config.host
        self.port = config.port
        self.ws_connects: set[WebSocket] = set()
        # Server
        self.unicast_id = id_generator()
        self.broadcast_id = id_generator()
        self.messages: deque[tuple[str, str]] = deque(maxlen=config.message_history_limit)
        self.public_groups = load_groups(config.public_groups)
        self.load_dir = Path(config.load_dir).resolve()
        self.load_dir.mkdir(parents=True, exist_ok=True)

    async def upload(self, file: UploadFile = File(...)):
        if not file.content_type:
            return Response(status_code=400, content="Invalid Content-Type")
        return Response(status_code=200, content=upload(self.load_dir, await file.read()))

    async def download(self, name: str, check: bool = Query(False)):
        filepath = self.load_dir / name
        if not filepath.is_relative_to(self.load_dir):  # 防止目录遍历漏洞
            return Response(status_code=403)
        if filepath.exists() and filepath.is_file():
            return Response(status_code=200) if check else FileResponse(path=filepath)
        return Response(status_code=404)

    async def find_message(self, message_id: str):
        message = next((msg for msg_id, msg in self.messages if msg_id == message_id), None)
        if message is None:
            return Response(status_code=404)
        return Response(status_code=200, content=message, media_type="application/json")

    async def find_message_history(self, message_id: str):
        payloads = []
        for i, message_payload in self.messages:
            if i == message_id:
                break
            payloads.append(message_payload)
        payloads.reverse()
        return Response(status_code=200, content=json.dumps(payloads), media_type="application/json")

    def unicast(self, ws: WebSocket, recv: MessageEvent, data: Message):
        data["messageId"] = f"unicast_{next(self.unicast_id)}"
        if "echo" in recv:
            data["echo"] = recv["echo"]
        payload = json.dumps(data)
        return ws.send_text(payload)

    def broadcast(self, recv: MessageEvent, data: Message):
        data["messageId"] = f"broadcast_{next(self.broadcast_id)}"
        if "echo" in recv:
            data["echo"] = recv["echo"]
        payload = json.dumps(data)
        self.messages.appendleft((data["messageId"], payload))
        return self.boardcast_payload(payload)

    async def console_broadcast(self, data: list[str]):
        console_message: ConsoleMessage = {"type": "system", "data": data}
        await self.boardcast_payload(json.dumps(console_message))

    async def boardcast_payload(self, payload: str):
        await asyncio.gather(*(ws.send_text(payload) for ws in self.ws_connects))

    async def reveive_event(self, ws: WebSocket):
        while True:
            recv = cast(MessageEvent, json.loads(await ws.receive_text()))
            if group := self.public_groups.get(recv["groupId"]):
                recv.update(group)  # type: ignore GroupInfo 包含 MessageEvent 的所有键
                send = partial(self.broadcast, recv)
            else:
                send = partial(self.unicast, ws, recv)
            if recv["at"]:
                if recv["at"][-1] == "":
                    recv["at"][-1] = self.BOT_NICKNAME
                    recv["to_me"] = True
                elif self.BOT_NICKNAME in recv["at"]:
                    recv["to_me"] = True
                else:
                    recv["to_me"] = False
            else:
                recv["to_me"] = False
            if not recv["text"].startswith(CONSOLE_PREFIX):
                asyncio.create_task(send(recv))
            recv["ip"] = ws.client.host if ws.client else None
            yield recv, send

    async def websocket_handler(self, ws: WebSocket):
        await ws.accept()
        self.ws_connects.add(ws)
        online_users = str(len(self.ws_connects))
        await self.console_broadcast(["onlineUsers", online_users])
        logger.info(f"New client connected. Total: {online_users}")
        reveive_event = self.reveive_event(ws)
        try:
            async for recv, send in reveive_event:
                self.dispatch(recv=recv, send=send, ws=ws, client=self)
        except WebSocketDisconnect:
            logger.info("Client disconnected.")
        except Exception:
            logger.exception("Error in websocket_handler")
        self.ws_connects.discard(ws)
        online_users = str(len(self.ws_connects))
        await self.console_broadcast(["onlineUsers", online_users])
        logger.info(f"Client remaining: {online_users}")

    def extract_message(self, recv: MessageEvent, **ignore):
        text = recv["text"]
        message = "".join(f"@{at} " for at in recv["at"]) + text + "".join(f"[image]({image})" for image in recv["images"])
        logger.info(f"[{recv["senderId"]}][{recv["groupId"]}]: {message}")
        if text.startswith(self.BOT_NICKNAME):
            text = text[self._length_bot_nickname :].lstrip()
            recv["to_me"] = True
        return text

    async def run(self):
        import uvicorn
        from fastapi.staticfiles import StaticFiles

        app = FastAPI()
        app.websocket("/ws")(self.websocket_handler)
        app.post("/upload")(self.upload)
        app.get("/download/{name:path}")(self.download)
        app.get("/message/{message_id}")(self.find_message)
        app.get("/message_history/{message_id}")(self.find_message_history)
        app.mount("/", StaticFiles(directory=PAGE_RESOURCE.as_posix(), html=True), name="static")
        config = uvicorn.Config(app, host=self.host, port=self.port, log_level="info")
        server = uvicorn.Server(config)
        await self.startup()
        await server.serve()
        await self.shutdown()
