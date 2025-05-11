import asyncio
import httpx
import websockets
import json
from clovers import Leaf
from clovers.logger import logger
from .config import __config__

url = __config__.url
ws_url = __config__.ws_url
Bot_Nickname = __config__.Bot_Nickname


class MyLeaf(Leaf):
    @staticmethod
    def extract_message(recv: dict, **ignore):
        if not recv.get("post_type") == "message":
            return
        message = "".join(seg["data"]["text"] for seg in recv["message"] if seg["type"] == "text")
        if message.startswith(Bot_Nickname):
            recv["to_me"] = True
            return message.lstrip(Bot_Nickname)
        return message

    async def run(self):
        client = httpx.AsyncClient()
        ws = None

        async def post(endpoint: str, **kwargs):
            resp = await client.post(url=f"{url}/{endpoint}", **kwargs)
            logger.info(resp.json().get("message", "No Message"))
            return resp

        asyncio.create_task(self.startup())
        while True:
            try:
                ws = await websockets.connect(ws_url)
                logger.info("websockets connected")
                while True:
                    recv = await ws.recv(decode=True)
                    recv = json.loads(recv)
                    user_id = recv.get("user_id", 0)
                    group_id = recv.get("group_id", "private")
                    raw_message = recv.get("raw_message", "None")
                    logger.info(f"[用户:{user_id}][群组：{group_id}]{raw_message}")
                    asyncio.create_task(self.response(post=post, recv=recv))
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(e)
            finally:
                await asyncio.sleep(5)
        await asyncio.create_task(self.shutdown())
        if ws:
            await ws.close()
            logger.info("websockets closed")
