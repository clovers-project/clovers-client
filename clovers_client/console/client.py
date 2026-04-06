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
from clovers_client.config import ClientConfig
from .utils import upload, int32_id_generator
from .typing import Message, MessageEvent

CONSOLE_PREFIX = b"\x05\x03\x01".decode()
PAGE_RESOURCE = Path(__file__).parent / "page"


class Config(ClientConfig):
    BOT_AVATAR_URL: str = "/download/bot_avatar.png"
    host: str = "127.0.0.1"
    port: int = 11000
    load_dir: str = "./load_dir"


class ConsoleClient(CloversCore):
    def __init__(self, config: Config = Config.sync_config("clovers")):
        super().__init__("CONSOLE")
        init_logger(logger, log_file=config.LOG_FILE, log_level=config.LOG_LEVEL)
        from .adapter import ADAPTER

        self.adapter.mixin(ADAPTER)
        # 初始化加载
        self.adapter.load_adapter(config.adapters, config.adapter_dirs)
        self.plugins.load_plugin(config.plugins, config.plugin_dirs)
        # inner
        self.message_id = int32_id_generator()
        self.messages: deque[tuple[str, str]] = deque(maxlen=100)
        self.BOT_NICKNAME = config.BOT_NICKNAME
        self.BOT_AVATAR_URL = config.BOT_AVATAR_URL
        self._length_bot_nickname = len(self.BOT_NICKNAME)
        # FastAPI
        self.host = config.host
        self.port = config.port
        self.ws_connects: set[WebSocket] = set()
        self.load_dir = Path(config.load_dir)
        self.load_dir.mkdir(parents=True, exist_ok=True)

    async def upload(self, file: UploadFile = File(...)):
        if not file.content_type:
            return Response(status_code=400, content="Invalid Content-Type")
        return Response(status_code=200, content=upload(self.load_dir, await file.read()))

    async def download(self, name: str, check: bool = Query(False)):
        filepath = self.load_dir / name
        if filepath.exists() and filepath.is_file():
            return Response(status_code=200) if check else FileResponse(path=filepath)
        return Response(status_code=404)

    async def find_message(self, message_id: str):
        message = next((msg for msg_id, msg in self.messages if msg_id == message_id), None)
        if message is None:
            return Response(status_code=404)
        return Response(status_code=200, content=message, media_type="application/json")

    def unicast(self, ws: WebSocket, data: Message):
        data["messageId"] = next(self.message_id)
        payload = json.dumps(data)
        self.messages.append((data["messageId"], payload))
        return ws.send_text(payload)

    def broadcast(self, data: Message):
        data["messageId"] = next(self.message_id)
        payload = json.dumps(data)
        self.messages.append((data["messageId"], payload))
        return self.boardcast_payload(payload)

    async def boardcast_payload(self, payload: str):
        await asyncio.gather(*(ws.send_text(payload) for ws in self.ws_connects))

    async def reveive_event(self, ws: WebSocket):
        while True:
            recv: MessageEvent = json.loads(await ws.receive_text())
            if recv["groupId"] == "private":
                send = partial(self.unicast, ws)
            else:
                send = self.broadcast
            if recv["at"] and recv["at"][-1] == "":
                del recv["at"][-1]
                recv["to_me"] = True
            else:
                recv["to_me"] = False
            if not recv["text"].startswith(CONSOLE_PREFIX):
                asyncio.create_task(send(recv))
            recv["ip"] = ws.client.host if ws.client else None
            yield recv, send

    async def websocket_handler(self, ws: WebSocket):
        await ws.accept()
        self.ws_connects.add(ws)
        logger.info(f"New client connected. Total: {len(self.ws_connects)}")
        reveive_event = self.reveive_event(ws)
        try:
            async for recv, send in reveive_event:
                self.dispatch(recv=recv, send=send, ws=ws, client=self)
        except WebSocketDisconnect:
            logger.info("Client disconnected.")
        except Exception:
            logger.exception("Error in websocket_handler")
        self.ws_connects.discard(ws)
        logger.info(f"Client remaining: {len(self.ws_connects)}")

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
        app.mount("/", StaticFiles(directory=PAGE_RESOURCE.as_posix(), html=True), name="static")
        config = uvicorn.Config(app, host=self.host, port=self.port, log_level="info")
        server = uvicorn.Server(config)
        await self.startup()
        await server.serve()
        await self.shutdown()
