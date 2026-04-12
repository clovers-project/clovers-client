import json
import asyncio
import websockets
from urllib.parse import urlparse
from clovers import CloversCore
from clovers.logger import logger
from clovers_client.logger import init_logger
from clovers_client.config import ClientConfig
from clovers_client.result import FileLike
from clovers_client.utils import int32_id_generator, f2s, f2b
from .typing import MessageEvent, APIResponse


class Config(ClientConfig):
    SUPERUSERS: set[str] = set()
    ws_url: str = "ws://127.0.0.1:3001"
    ws_token: str | None = None


class OneBotV11Client(CloversCore):
    def __init__(self, config: Config = Config.sync_config("clovers")):
        super().__init__("OneBot V11")
        init_logger(logger, log_file=config.LOG_FILE, log_level=config.LOG_LEVEL)
        from .adapter import ADAPTER

        self.adapter.mixin(ADAPTER)
        # 初始化加载
        self.load_adapter(config.adapters, config.adapter_dirs)
        self.load_plugin(config.plugins, config.plugin_dirs)
        # inner
        self.message_id = int32_id_generator()
        self.BOT_NICKNAME = config.BOT_NICKNAME
        self.SUPERUSERS = config.SUPERUSERS
        self._length_bot_nickname = len(self.BOT_NICKNAME)
        # OneBot V11
        self.ws_url = config.ws_url
        self.ws_token = config.ws_token
        self.format_file = f2s if urlparse(config.ws_url).hostname in ("127.0.0.1", "::1", "localhost") else f2b
        self.api_futures: dict[str, asyncio.Future] = {}

    @staticmethod
    def format_file(file: FileLike) -> str: ...
    async def run_api_connect(self, headers: dict | None):
        self.ws_api = await websockets.connect(f"{self.ws_url}/api", additional_headers=headers)
        async for recv_data in self.ws_api:
            recv: APIResponse = json.loads(recv_data)
            if (echo := recv.get("echo")) and (future := self.api_futures.pop(echo, None)) and not future.done():
                future.set_result(recv["data"])

    async def call_api(self, endpoint: str, params: dict, need_response: bool = False):
        if need_response:
            echo = next(self.message_id)
            future = self.api_futures[echo] = asyncio.get_running_loop().create_future()
            try:
                await self.ws_api.send(json.dumps({"action": endpoint, "params": params, "echo": echo}))
                return await asyncio.wait_for(future, timeout=10.0)
            except:
                del self.api_futures[echo]
                raise
        else:
            await self.ws_api.send(json.dumps({"action": endpoint, "params": params}))

    def extract_message(self, recv: MessageEvent, **ignore) -> str | None:
        message = "".join(seg["data"]["text"] for seg in recv["message"] if seg["type"] == "text")
        message = message.lstrip()
        user_id = recv.get("user_id", 0)
        raw_message = recv.get("raw_message", "null")
        if recv.get("message_type") == "private":
            logger.info(f"[{user_id}][private]: {raw_message}")
            recv["to_me"] = True
        else:
            logger.info(f"[{user_id}][{recv.get("group_id", "unknown")}]: {raw_message}")
        if message.startswith(self.BOT_NICKNAME):
            recv["to_me"] = True
            return message[self._length_bot_nickname :].lstrip()
        return message

    async def run(self):
        headers = {"Authorization": f"Bearer {self.ws_token}"} if self.ws_token else None
        async with self:
            while self._ready:
                try:
                    ws_connect = await websockets.connect(self.ws_url, additional_headers=headers)
                    self.create_task(self.run_api_connect(headers))
                    logger.info("websockets connected")
                    async for recv_data in ws_connect:
                        recv = json.loads(recv_data)
                        if not recv.get("post_type") == "message":
                            continue
                        self.dispatch(call=self.call_api, recv=recv, client=self)
                    logger.info("client closed")
                    await asyncio.sleep(5)  # 正常关闭也会尝试重连
                except (websockets.exceptions.ConnectionClosedError, TimeoutError):
                    logger.error("websockets reconnecting...")
                    await asyncio.sleep(5)
                except ConnectionRefusedError as e:
                    logger.error(f"ConnectionRefusedError: {e}")
                    logger.error(f"Please check service on {self.ws_url}")
                    return
                except Exception:
                    logger.exception("something error")
                    return
