import json
import asyncio
from pathlib import Path
from functools import partial
from collections import deque
from fastapi import FastAPI, File, Header, Depends, Query, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response, FileResponse
from clovers import CloversCore
from clovers.logger import logger
from clovers_client.logger import init_logger
from clovers_client.utils import id_generator
from .utils import upload
from typing import cast
from .protocol import GroupInfo, ConsoleMessage, Message, MessageEvent
from .config import Config

PAGE_RESOURCE = Path(__file__).parent / "page"


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
        # FastAPI
        self.host = config.host
        self.port = config.port
        self.ws_connects: set[WebSocket] = set()
        # Server
        self.unicast_id = id_generator()
        self.broadcast_id = id_generator()
        self.messages: deque[tuple[str, str]] = deque(maxlen=config.message_history_limit)
        # data
        self.data_dir = Path(config.data_dir).resolve()
        self.stores_dir = self.data_dir / "stores_dir"
        self._public_groups_config_file = self.data_dir / "public_groups_config.json"
        self._auth_tokens_config_file = self.data_dir / "auth_tokens.json"
        # stores
        self.stores_dir.mkdir(parents=True, exist_ok=True)
        # public_groups
        self.public_groups_json: str = ""
        self.public_groups: dict[str, GroupInfo] = {}
        self.reload_public_groups()
        # auth_tokens
        self.auth_tokens: set[str] = set()
        self.reload_auth_tokens()

    def reload_public_groups(self):
        file = self._public_groups_config_file
        self.public_groups_json = ""
        self.public_groups.clear()
        if not file.exists():
            file.write_text(json.dumps([{"groupName": "", "groupId": "", "groupAvatar": ""}]))
            return
        self.public_groups_json = file.read_text("utf-8")
        groups = json.loads(self.public_groups_json)
        if not isinstance(groups, list):
            return

        def valid_g(g: dict) -> bool:
            for k in ("groupName", "groupId", "groupAvatar"):
                if k not in g:
                    return False
                if not g[k]:
                    continue
                if not isinstance(g[k], str):
                    return False
            return True

        self.public_groups.update((g["groupId"], g) for g in groups if valid_g(g))
        return

    def reload_auth_tokens(self):
        self.auth_tokens.clear()
        if not self._auth_tokens_config_file.exists():
            self._auth_tokens_config_file.write_text(json.dumps([]))
        else:
            with self._auth_tokens_config_file.open("r", encoding="utf-8") as f:
                self.auth_tokens.update(json.load(f))

    async def verify_token(self, authorization: str = Header(...)):
        if authorization.startswith("Bearer "):
            token = authorization.removeprefix("Bearer ")
            if token in self.auth_tokens:
                return
        raise HTTPException(status_code=401, detail="Invalid Authorization")

    async def handle_action(self, action: str, args: str = ""):
        match action:
            case "reload_public_groups":
                self.reload_public_groups()
            case "reload_auth_tokens":
                self.reload_auth_tokens()
            case "broadcast":
                await self.console_broadcast(json.loads(args))

    async def handle_upload(self, file: UploadFile = File(...)):
        if not file.content_type:
            return Response(status_code=400, content="Invalid Content-Type")
        return Response(status_code=200, content=upload(self.stores_dir, await file.read()))

    async def handle_download(self, name: str, check: bool = Query(False)):
        filepath = self.stores_dir / name
        if not filepath.is_relative_to(self.stores_dir):  # 防止目录遍历漏洞
            return Response(status_code=403)
        if filepath.exists() and filepath.is_file():
            return Response(status_code=200) if check else FileResponse(path=filepath)
        return Response(status_code=404)

    async def get_message(self, message_id: str):
        message = next((msg for msg_id, msg in self.messages if msg_id == message_id), None)
        if message is None:
            return Response(status_code=404)
        return Response(status_code=200, content=message, media_type="application/json")

    async def get_message_history(self, message_id: str):
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
            asyncio.create_task(send(recv))
            recv["ip"] = ws.client.host if ws.client else None
            yield recv, send

    async def websocket_handler(self, ws: WebSocket):
        await ws.accept()
        self.ws_connects.add(ws)
        online_users = str(len(self.ws_connects))
        await self.console_broadcast(["onlineUsers", online_users])
        logger.info(f"New client connected. Total: {online_users}")
        if self.public_groups_json:
            await self.console_broadcast(["publicGroups", self.public_groups_json])
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
        if not recv["to_me"] and text.startswith(self.BOT_NICKNAME):
            text = text.removeprefix(self.BOT_NICKNAME)
            recv["to_me"] = True
        return text

    async def run(self):
        import uvicorn

        app = FastAPI()
        app.websocket("/ws")(self.websocket_handler)
        app.get("/action", dependencies=[Depends(self.verify_token)])(self.handle_action)
        app.post("/upload")(self.handle_upload)
        app.get("/download/{name:path}")(self.handle_download)
        app.get("/message/{message_id}")(self.get_message)
        app.get("/message_history/{message_id}")(self.get_message_history)
        app.mount("/", StaticFiles(directory=PAGE_RESOURCE.as_posix(), html=True), name="static")
        config = uvicorn.Config(app, host=self.host, port=self.port, log_level="info")
        server = uvicorn.Server(config)
        await self.startup()
        await server.serve()
        await self.shutdown()
