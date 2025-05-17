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
    def __init__(self, name="OneBot V11"):
        super().__init__(name)
        # 下面是获取配置
        self.client = httpx.AsyncClient()
        self.ws_connect = websockets.connect(ws_url)

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
        if recv.get("message_type") == "private":
            recv["to_me"] = True
        if message.startswith(Bot_Nickname):
            recv["to_me"] = True
            return message.lstrip(Bot_Nickname)
        return message

    async def post(self, endpoint: str, **kwargs) -> dict:
        resp = await self.client.post(url=f"{url}/{endpoint}", **kwargs)
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

    async def run(self):
        async with self:
            ws = None
            err = None
            while self.running:
                try:
                    ws = await self.ws_connect
                    logger.info("websockets connected")
                    async for recv in ws:
                        recv = json.loads(recv)
                        self.recv_log(recv)
                        asyncio.create_task(self.response(post=self.post, recv=recv))
                except websockets.exceptions.ConnectionClosedError:
                    logger.exception("websockets reconnecting...")
                    await asyncio.sleep(5)
                except Exception as e:
                    err = e
                    break
        if ws is not None:
            await ws.close()
            logger.info("websockets closed")
        if err is not None:
            raise err
