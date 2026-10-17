import json
import asyncio
import signal
import time
from pathlib import Path
from functools import partial
from collections import deque
from fastapi import FastAPI, File, Header, Depends, Query, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response, FileResponse, JSONResponse
from clovers import CloversCore
from clovers.logger import logger
from clovers_client.logger import init_logger
from clovers_client.utils import id_generator
from .utils import upload
from pydantic import TypeAdapter, ValidationError
from .protocol import GroupInfo, Message, MessageEvent
from .config import Config

PAGE_RESOURCE = Path(__file__).parent / "page"
MAX_UPLOAD_SIZE = 1024 * 1024 * 10

TA_MESSAGE_EVENT = TypeAdapter(MessageEvent)
TA_GROUPS = TypeAdapter(list[GroupInfo])


class RateLimiter:
    """滑动窗口速率限制器，按 WebSocket 连接独立计数。"""

    def __init__(self, max_messages: int = 20, window_seconds: float = 1.0):
        self.max_messages = max_messages
        self.window_seconds = window_seconds
        # ws -> deque of timestamps
        self._windows: dict[id[WebSocket], deque[float]] = {}

    def is_allowed(self, ws: WebSocket) -> bool:
        ws_id = id(ws)
        now = time.monotonic()
        if ws_id not in self._windows:
            self._windows[ws_id] = deque()
        window = self._windows[ws_id]
        # 移除窗口外的旧记录
        while window and now - window[0] > self.window_seconds:
            window.popleft()
        if len(window) >= self.max_messages:
            return False
        window.append(now)
        return True

    def cleanup(self, ws: WebSocket):
        """连接断开时清理记录。"""
        ws_id = id(ws)
        self._windows.pop(ws_id, None)


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
        # 速率限制器 (默认: 每秒最多 20 条消息)
        self.rate_limiter = RateLimiter(
            max_messages=config.ws_rate_limit_max if hasattr(config, 'ws_rate_limit_max') else 20,
            window_seconds=config.ws_rate_limit_window if hasattr(config, 'ws_rate_limit_window') else 1.0,
        )
        # 优雅关闭标志
        self._shutdown_event = asyncio.Event()

    def reload_public_groups(self):
        self.public_groups_json = ""
        self.public_groups.clear()
        if not self._public_groups_config_file.exists():
            self._public_groups_config_file.write_text(json.dumps([{"groupName": "", "groupId": "", "groupAvatar": ""}]))
            return
        public_groups_json = self._public_groups_config_file.read_text("utf-8")
        try:
            groups = TA_GROUPS.validate_python(json.loads(public_groups_json))
        except (json.JSONDecodeError, ValidationError):
            return
        self.public_groups_json = public_groups_json
        self.public_groups.update((group_id, g) for g in groups if (group_id := g["groupId"]))
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
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            return Response(status_code=413, content="File too large")
        return Response(status_code=200, content=upload(self.stores_dir, content))

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

    @staticmethod
    async def _unicast_payload(ws: WebSocket, payload: str):
        try:
            await ws.send_text(payload)
        except Exception:
            pass

    async def _boardcast_payload(self, payload: str):
        await asyncio.gather(*(self._unicast_payload(ws, payload) for ws in self.ws_connects))

    def unicast(self, ws: WebSocket, recv: MessageEvent, data: Message):
        data["messageId"] = f"unicast_{next(self.unicast_id)}"
        if "echo" in recv:
            data["echo"] = recv["echo"]
        payload = json.dumps(data)
        return self._unicast_payload(ws, payload)

    def broadcast(self, recv: MessageEvent, data: Message):
        data["messageId"] = f"broadcast_{next(self.broadcast_id)}"
        if "echo" in recv:
            data["echo"] = recv["echo"]
        payload = json.dumps(data)
        self.messages.appendleft((data["messageId"], payload))
        return self._boardcast_payload(payload)

    async def console_broadcast(self, data: list[str]):
        await self._boardcast_payload(json.dumps({"type": "system", "data": data}))

    async def websocket_handler(self, ws: WebSocket):
        await ws.accept()
        self.ws_connects.add(ws)
        online_users = str(len(self.ws_connects))
        await self.console_broadcast(["onlineUsers", online_users])
        logger.info(f"New client connected. Total: {online_users}")
        if self.public_groups_json:
            await self.console_broadcast(["publicGroups", self.public_groups_json])
        try:
            while True:
                # 优雅关闭: 检查是否收到关闭信号
                if self._shutdown_event.is_set():
                    logger.info("Shutdown signal received, closing websocket handler.")
                    break
                try:
                    raw = await asyncio.wait_for(ws.receive_text(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                except WebSocketDisconnect:
                    logger.info("Client disconnected.")
                    break
                # 速率限制检查
                if not self.rate_limiter.is_allowed(ws):
                    await ws.send_text(json.dumps({
                        "type": "error",
                        "data": ["Rate limit exceeded. Please slow down."]
                    }))
                    continue
                try:
                    recv = TA_MESSAGE_EVENT.validate_python(json.loads(raw))
                    group_id = recv["groupId"]
                except (json.JSONDecodeError, ValidationError):
                    continue
                except Exception:
                    logger.exception("Error in websocket_handler")
                    break
                if group := self.public_groups.get(group_id):
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
                self.dispatch(recv=recv, send=send, ws=ws, client=self)
        finally:
            # 确保清理: 无论正常退出还是异常退出都执行
            self.ws_connects.discard(ws)
            self.rate_limiter.cleanup(ws)
            online_users = str(len(self.ws_connects))
            await self.console_broadcast(["onlineUsers", online_users])
            logger.info(f"Client remaining: {online_users}")

    def extract_message(self, recv: MessageEvent, **ignore):
        text = recv["text"]
        message = "".join(f"@{at} " for at in recv["at"]) + text + "".join(f"[image]({image})" for image in recv["images"])
        logger.info(f"[{recv['senderId']}][{recv['groupId']}]: {message}")
        if not recv["to_me"] and text.startswith(self.BOT_NICKNAME):
            text = text.removeprefix(self.BOT_NICKNAME)
            recv["to_me"] = True
        return text

    async def shutdown(self):
        """优雅关闭: 关闭所有 WebSocket 连接并等待任务完成。"""
        logger.info("Shutting down gracefully...")
        self._shutdown_event.set()
        # 关闭所有活跃的 WebSocket 连接
        closing_tasks = []
        for ws in list(self.ws_connects):
            try:
                closing_tasks.append(ws.close(code=1001, reason="Server shutting down"))
            except Exception:
                pass
        if closing_tasks:
            await asyncio.gather(*closing_tasks, return_exceptions=True)
        self.ws_connects.clear()
        logger.info("All WebSocket connections closed.")

    async def run(self):
        import uvicorn
        import os
        import sys

        app = FastAPI()
        app.websocket("/ws")(self.websocket_handler)
        app.get("/action", dependencies=[Depends(self.verify_token)])(self.handle_action)
        app.post("/upload")(self.handle_upload)
        app.get("/download/{name:path}")(self.handle_download)
        app.get("/message/{message_id}")(self.get_message)
        app.get("/message_history/{message_id}")(self.get_message_history)
        # === 健康检查接口 ===
        @app.get("/health")
        async def health_check():
            """存活探针: 返回 200 表示服务正在运行。"""
            return JSONResponse(content={
                "status": "ok",
                "connected_clients": len(self.ws_connects),
            })

        @app.get("/ready")
        async def readiness_check():
            """就绪探针: 返回 200 表示服务已就绪。"""
            return JSONResponse(content={
                "status": "ready",
                "connected_clients": len(self.ws_connects),
            })

        app.mount("/", StaticFiles(directory=PAGE_RESOURCE.as_posix(), html=True), name="static")
        config = uvicorn.Config(app, host=self.host, port=self.port, log_level="info")
        server = uvicorn.Server(config)

        # === 优雅关闭: 注册信号处理器 ===
        loop = asyncio.get_running_loop()
        shutdown_tasks: list[asyncio.Task] = []

        def _signal_handler():
            """信号回调: 设置关闭事件并触发优雅关闭。"""
            logger.info("Received shutdown signal.")
            asyncio.create_task(self._graceful_shutdown(server))

        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                loop.add_signal_handler(sig, _signal_handler)
            except (NotImplementedError, SystemError):
                # Windows 不支持 add_signal_handler
                pass

        await self.startup()
        await server.serve()
        # serve() 退出后执行最终清理
        await self.shutdown()

    async def _graceful_shutdown(self, server):
        """优雅关闭流程: 停止接收新连接 -> 关闭现有连接 -> 停止服务器。"""
        logger.info("Starting graceful shutdown...")
        # 1. 设置关闭标志，阻止新消息处理
        self._shutdown_event.set()
        # 2. 关闭所有 WebSocket 连接
        closing_tasks = []
        for ws in list(self.ws_connects):
            try:
                closing_tasks.append(ws.close(code=1001, reason="Server shutting down"))
            except Exception:
                pass
        if closing_tasks:
            await asyncio.gather(*closing_tasks, return_exceptions=True)
        self.ws_connects.clear()
        logger.info("All WebSocket connections closed.")
        # 3. 停止接收新请求
        await server.shutdown()
        logger.info("Server shutdown complete.")
