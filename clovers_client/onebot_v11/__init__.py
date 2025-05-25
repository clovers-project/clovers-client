import json
from pathlib import Path
import asyncio
import httpx
import websockets
from clovers import LeafClient
from clovers.utils import list_modules
from clovers.logger import logger
from .adapter import __adapter__
from .config import __config__

url = __config__.url
ws_url = __config__.ws_url
Bot_Nickname = __config__.Bot_Nickname


class Client(LeafClient):
    def __init__(self, name="OneBot V11", url=url, ws_url=ws_url):
        super().__init__(name)
        # 下面是获取配置
        self.url = url
        self.ws_url = ws_url
        self.adapter.update(__adapter__)

        for adapter in __config__.adapters:
            self.load_adapter(adapter)
        for adapter_dir in __config__.adapter_dirs:
            adapter_dir = Path(adapter_dir)
            if not adapter_dir.exists():
                adapter_dir.mkdir(parents=True, exist_ok=True)
                continue
            for adapter in list_modules(adapter_dir):
                self.load_adapter(adapter)

        for plugin in __config__.plugins:
            self.load_plugin(plugin)
        for plugin_dir in __config__.plugin_dirs:
            plugin_dir = Path(plugin_dir)
            if not plugin_dir.exists():
                plugin_dir.mkdir(parents=True, exist_ok=True)
                continue
            for plugin in list_modules(plugin_dir):
                self.load_plugin(plugin)

    def extract_message(self, recv: dict, **ignore) -> str | None:
        if not recv.get("post_type") == "message":
            return
        message = "".join(seg["data"]["text"] for seg in recv["message"] if seg["type"] == "text")
        message = message.lstrip()
        if recv.get("message_type") == "private":
            recv["to_me"] = True
        if message.startswith(Bot_Nickname):
            recv["to_me"] = True
            return message.lstrip(Bot_Nickname)
        return message.lstrip()

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
        self.client = httpx.AsyncClient()
        return super().startup()

    async def shutdown(self):
        await self.client.aclose()
        return super().shutdown()

    async def main_loop(self, ws_connect: websockets.connect):
        while self.running:
            async for recv in await ws_connect:
                recv = json.loads(recv)
                self.recv_log(recv)
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
