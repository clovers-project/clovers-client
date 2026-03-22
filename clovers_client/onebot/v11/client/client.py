import asyncio
import json
import httpx
import websockets
from clovers import Leaf, Client
from clovers_client.logger import logger
from ..typing import MessageEvent
from .config import Config

__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname
LEN_BOT_NICKNAME = len(BOT_NICKNAME)


class OneBotV11Client(Leaf, Client):
    def __init__(self):
        super().__init__("OneBot V11")
        # 下面是获取配置
        self.url = __config__.url
        self.ws_url = __config__.ws_url
        self.http_token = __config__.http_token
        self.ws_token = __config__.ws_token
        self.load_adapters_from_list(__config__.adapters)
        self.load_adapters_from_dirs(__config__.adapter_dirs)
        self.load_plugins_from_list(__config__.plugins)
        self.load_plugins_from_dirs(__config__.plugin_dirs)

    def extract_message(self, recv: MessageEvent, **ignore) -> str | None:
        if not recv.get("post_type") == "message":
            return
        message = "".join(seg["data"]["text"] for seg in recv["message"] if seg["type"] == "text")
        message = message.lstrip()
        if recv.get("message_type") == "private":
            recv["to_me"] = True
        if message.startswith(BOT_NICKNAME):
            recv["to_me"] = True
            return message[LEN_BOT_NICKNAME:].lstrip()
        return message

    async def post(self, endpoint: str, **kwargs):
        return await self.client.post(url=f"{self.url}/{endpoint}", **kwargs)

    @staticmethod
    def recv_log(recv: MessageEvent):
        user_id = recv.get("user_id", 0)
        message_type = recv.get("message_type")
        raw_message = recv.get("raw_message", "None")
        info = "私聊" if message_type == "private" else f"群组：{recv.get("group_id", "unknown")}"
        logger.info(f"[{user_id}][{info}]: {raw_message}")

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
                            self.recv_log(recv)
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


__client__ = OneBotV11Client()
