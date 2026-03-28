import json
import asyncio
from pathlib import Path
from functools import partial
from fastapi import FastAPI, File, UploadFile, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from clovers import Leaf, Client
from clovers.logger import logger
from clovers_client import init_logger
from .adapter import __adapter__
from .utils import upload, int32_generator
from .config import Config
from .typing import ChatMessage, MessageEvent, CONSOLE_PREFIX


PAGE_RESOURCE = Path(__file__).parent / "page"
ALLOWED_TYPES = {"image", "video", "audio"}


class ConsoleClient(Leaf, Client):
    def __init__(self, config: Config = Config.sync_config()):
        super().__init__("CONSOLE")
        init_logger(logger, log_file=config.LOG_FILE, log_level=config.LOG_LEVEL)
        self.BOT_NICKNAME = config.BOT_NICKNAME
        self._length_bot_nickname = len(self.BOT_NICKNAME)
        self.BOT_AVATAR_URL = config.BOT_AVATAR_URL
        self.adapter.update(__adapter__)
        # 初始化加载
        self.load_adapters_from_list(config.adapters)
        self.load_adapters_from_dirs(config.adapter_dirs)
        self.load_plugins_from_list(config.plugins)
        self.load_plugins_from_dirs(config.plugin_dirs)
        # inner
        self.message_id = int32_generator()
        # FastAPI
        self.host = config.host
        self.port = config.port
        self.ws_connects: set[WebSocket] = set()
        self.load_dir = Path(config.load_dir)
        self.load_dir.mkdir(parents=True, exist_ok=True)
        self.app = FastAPI()
        self.app.websocket("/ws")(self.websocket_handler)
        self.app.post("/upload")(self.upload)
        self.app.get("/download/{name}")(self.download)
        self.app.mount("/", StaticFiles(directory=PAGE_RESOURCE.as_posix(), html=True), name="static")

    async def upload(self, file: UploadFile = File(...)):
        if not file.content_type:
            return Response(status_code=400, content="Invalid Content-Type")
        return Response(status_code=200, content=upload(self.load_dir, await file.read()))

    async def download(self, name: str, check: bool = Query(False)):
        filepath = self.load_dir / name
        if not filepath.exists():
            return Response(status_code=404)
        return Response(status_code=200) if check else FileResponse(path=filepath)

    def unicast(self, ws: WebSocket, data: ChatMessage):
        data["messageId"] = next(self.message_id)
        return ws.send_text(json.dumps(data))

    def broadcast(self, data: ChatMessage):
        data["messageId"] = next(self.message_id)
        return self.boardcast_payload(json.dumps(data))

    async def boardcast_payload(self, payload: str):
        return await asyncio.gather(*(ws.send_text(payload) for ws in self.ws_connects), return_exceptions=True)

    async def websocket_handler(self, ws: WebSocket):
        await ws.accept()
        self.ws_connects.add(ws)
        logger.info(f"New client connected. Total: {len(self.ws_connects)}")
        tasks: set[asyncio.Task] = set()
        try:
            while True:
                recv: MessageEvent = json.loads(await ws.receive_text())
                if recv["groupId"] == "private":
                    send = partial(self.unicast, ws)
                else:
                    send = self.broadcast
                if not recv["text"].startswith(CONSOLE_PREFIX):
                    asyncio.create_task(send(recv))
                recv["ip"] = ws.client.host if ws.client else None
                recv["bot_nickname"] = self.BOT_NICKNAME
                recv["bot_avatar"] = self.BOT_AVATAR_URL
                task = asyncio.create_task(self.response(recv=recv, send=send, load_dir=self.load_dir))
                tasks.add(task)
                task.add_done_callback(tasks.discard)
        except WebSocketDisconnect:
            logger.info("Client disconnected.")
        except Exception:
            logger.exception("Error in websocket_handler")
        finally:
            if tasks:
                for task in tasks:
                    if not task.done():
                        task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
            self.ws_connects.discard(ws)
            logger.info(f"Client remaining: {len(self.ws_connects)}")

    def extract_message(self, recv: MessageEvent, **ignore):
        text = recv["text"]
        message = " ".join(f"@[{at}]" for at in recv["at"]) + text + "".join(f"[image]({image})" for image in recv["images"])
        logger.info(f"[{recv["senderId"]}][{recv["groupId"]}]: {message}")
        if text.startswith(self.BOT_NICKNAME):
            recv["text"] = text[self._length_bot_nickname :].lstrip()
            recv["to_me"] = True
        else:
            recv["to_me"] = False
        return recv["text"]

    async def run(self):
        import uvicorn

        config = uvicorn.Config(self.app, host=self.host, port=self.port, log_level="info")
        server = uvicorn.Server(config)
        logger.info(f"ConsoleClient running at http://{self.host}:{self.port}")
        async with self:
            await server.serve()
