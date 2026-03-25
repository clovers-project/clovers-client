import asyncio
import json
import httpx
import websockets
from clovers import Leaf, Client
from clovers.logger import logger
from ..typing import MessageEvent
from .config import Config


class OneBotV11Client(Leaf, Client):
    def __init__(self, config: Config = Config.sync_config()):
        super().__init__("OneBot V11")
        init_logger(logger, log_file=config.LOG_FILE, log_level=config.LOG_LEVEL)
        self.BOT_NICKNAME = config.Bot_Nickname
        self._length_bot_nickname = len(self.BOT_NICKNAME)
        # 下面是获取配置
        self.url = config.url
        self.ws_url = config.ws_url
        self.http_token = config.http_token
        self.ws_token = config.ws_token
        self.load_adapters_from_list(config.adapters)
        self.load_adapters_from_dirs(config.adapter_dirs)
        self.load_plugins_from_list(config.plugins)
        self.load_plugins_from_dirs(config.plugin_dirs)

    def extract_message(self, recv: MessageEvent, **ignore) -> str | None:
        if not recv.get("post_type") == "message":
            return
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

    async def post(self, endpoint: str, **kwargs):
        return await self.client.post(url=f"{self.url}/{endpoint}", **kwargs)

    def startup(self):
        headers = {"Authorization": f"Bearer {self.http_token}"} if self.http_token else None
        self.client = httpx.AsyncClient(headers=headers, timeout=30)
        return super().startup()

    async def shutdown(self):
        await self.client.aclose()
        return await super().shutdown()

    async def run(self):
        headers = {"Authorization": f"Bearer {self.ws_token}"} if self.ws_token else None
        async with self:
            while self.running:
                try:
                    ws_connect = await websockets.connect(self.ws_url, additional_headers=headers)
                    logger.info("websockets connected")
                    async for recv_data in ws_connect:
                        recv = json.loads(recv_data)
                        post_type = recv.get("post_type")
                        if post_type == "message":
                            asyncio.create_task(self.response(post=self.post, recv=recv))
                    logger.info("client closed")
                    return
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
