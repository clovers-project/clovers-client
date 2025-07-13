import asyncio
import json
import httpx
import websockets
from clovers import Leaf, Client
from clovers_client.logger import logger
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
        self.load_adapters_from_list(__config__.adapters)
        self.load_adapters_from_dirs(__config__.adapter_dirs)
        self.load_plugins_from_list(__config__.plugins)
        self.load_plugins_from_dirs(__config__.plugin_dirs)

    def extract_message(self, recv: dict, **ignore) -> str | None:
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

    async def post(self, endpoint: str, **kwargs) -> dict:
        resp = await self.client.post(url=f"{self.url}/{endpoint}", **kwargs)
        resp = resp.json()
        logger.info(resp.get("message", "No Message"))
        return resp

    @staticmethod
    def resp_log(resp: dict):
        logger.info(resp.get("message", "No Message"))

    @staticmethod
    def recv_log(recv: dict):
        user_id = recv.get("user_id", 0)
        group_id = recv.get("group_id", "private")
        raw_message = recv.get("raw_message", "None")
        logger.info(f"[用户:{user_id}][群组：{group_id}]{raw_message}")

    def startup(self):
        self.client = httpx.AsyncClient(timeout=30)
        return super().startup()

    async def shutdown(self):
        await self.client.aclose()
        return super().shutdown()

    async def main_loop(self, ws_connect: websockets.connect):
        while self.running:
            async for recv_data in await ws_connect:
                self.recv_log(recv := json.loads(recv_data))
                asyncio.create_task(self.response(post=self.post, recv=recv))
        logger.info("client closed")

    async def run(self):
        async with self:
            while True:
                try:
                    ws_connect = websockets.connect(self.ws_url)
                    logger.info("websockets connected")
                    await self.main_loop(ws_connect)
                    return
                except websockets.exceptions.ConnectionClosedError:
                    logger.error("websockets reconnecting...")
                    await asyncio.sleep(5)
                except Exception:
                    logger.exception("something error")
                    return


__client__ = OneBotV11Client()
