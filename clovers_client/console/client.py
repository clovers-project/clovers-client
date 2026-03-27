import json
import asyncio
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from clovers import Leaf, Client
from clovers.logger import logger
from clovers_client import init_logger
from .adapter import __adapter__
from .config import Config
from .typing import MessageEvent, CONSOLE_PREFIX


PAGE_RESOURCE = Path(__file__).parent / "page"


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
        # FastAPI
        self.host = config.host
        self.port = config.port
        self.ws_connects: set[WebSocket] = set()
        self.app = FastAPI()
        self.app.websocket("/ws")(self.websocket_handler)
        self.app.mount("/", StaticFiles(directory=PAGE_RESOURCE.as_posix(), html=True), name="static")

    async def websocket_handler(self, ws: WebSocket):
        await ws.accept()
        self.ws_connects.add(ws)
        logger.info(f"New client connected. Total: {len(self.ws_connects)}")
        tasks: set[asyncio.Task] = set()
        try:
            while True:
                receive_text = await ws.receive_text()
                recv: MessageEvent = json.loads(receive_text)
                recv["ip"] = ws.client.host if ws.client else None
                recv["bot_nickname"] = self.BOT_NICKNAME
                recv["bot_avatar"] = self.BOT_AVATAR_URL
                send = ws.send_text if recv["groupId"] == "private" else self.broadcast
                if not recv["text"].startswith(CONSOLE_PREFIX):
                    asyncio.create_task(send(receive_text))
                task = asyncio.create_task(self.response(recv=recv, send=send))
                tasks.add(task)
                task.add_done_callback(tasks.discard)
        except WebSocketDisconnect:
            logger.info("Client disconnected.")
        except Exception:
            logger.exception("Error in websocket_handler")
        if tasks:
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

    async def broadcast(self, data: str):
        """定义一个全局可用的广播工具"""
        if not self.ws_connects:
            return
        await asyncio.gather(*(ws.send_text(data) for ws in self.ws_connects), return_exceptions=True)

    async def run(self):
        import uvicorn

        config = uvicorn.Config(self.app, host=self.host, port=self.port, log_level="info")
        server = uvicorn.Server(config)
        logger.info(f"ConsoleClient running at http://{self.host}:{self.port}")
        async with self:
            await server.serve()
