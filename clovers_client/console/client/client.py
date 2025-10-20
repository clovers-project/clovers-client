import json
import asyncio
import websockets
from clovers import Leaf, Client
from clovers_client.logger import logger
from .config import Config

__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname
LEN_BOT_NICKNAME = len(BOT_NICKNAME)


class ConsoleClient(Leaf, Client):
    def __init__(self):
        super().__init__("CONSOLE")
        self.ws_host = __config__.ws_host
        self.ws_port = __config__.ws_port
        self.ws_connects: set[websockets.ServerConnection] = set()
        self.load_adapters_from_list(__config__.adapters)
        self.load_adapters_from_dirs(__config__.adapter_dirs)
        self.load_plugins_from_list(__config__.plugins)
        self.load_plugins_from_dirs(__config__.plugin_dirs)

    def extract_message(self, recv_data: dict, **ignore):
        text = recv_data["text"]
        logger.info(f"Receive: {recv_data['senderName']}: {text}")
        if text.startswith(BOT_NICKNAME):
            recv_data["text"] = text[LEN_BOT_NICKNAME:].lstrip()
        recv_data["to_me"] = True
        args = text.split(" --args", 1)
        if len(args) == 2:
            text, args = args
            for arg in args.split():
                if arg.startswith("at:"):
                    recv_data.setdefault("at", []).append(arg[3:])
                elif arg == "private":
                    recv_data["is_private"] = True
        return text

    async def websocket_handler(self, websocket: websockets.ServerConnection):
        # request = websocket.request
        # if request is None:
        #     logger.warning("Connection rejected: No request found.")
        #     return
        # user_info = {}
        # user_info["user_id"] = request.headers.get("UserInfo-User-ID", "0")
        # user_info["group_id"] = request.headers.get("UserInfo-Group-ID", "0")
        # user_info["nickname"] = request.headers.get("UserInfo-Nickname", "ConsoleUser")
        # user_info["avatar"] = request.headers.get("UserInfo-Avatar", "https://localhost:8080/avatar/0.png")
        # user_info["group_avatar"] = request.headers.get("UserInfo-Group-Avatar", "https://localhost:8080/group_avatar/0.png")
        # match request.headers.get("UserInfo-Permission"):
        #     case "SuperUser":
        #         user_info["permission"] = 3
        #     case "Owner":
        #         user_info["permission"] = 2
        #     case "Admin":
        #         user_info["permission"] = 1
        #     case _:
        #         user_info["permission"] = 0
        # user = User(**user_info)
        self.ws_connects.add(websocket)
        logger.info(f"New client connected. Total connections: {len(self.ws_connects)}")
        try:
            async for recv_data in websocket:
                asyncio.create_task(self.response(recv_data=json.loads(recv_data), ws_connects=self.ws_connects))
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected.")
        except Exception:
            logger.exception("Error in websocket_handler")
        finally:
            self.ws_connects.discard(websocket)
            logger.info(f"Client disconnected. Total connections: {len(self.ws_connects)}")

    async def run(self):
        async with self:
            server = await websockets.serve(self.websocket_handler, self.ws_host, self.ws_port, ping_interval=30, ping_timeout=10)
            logger.info(f"WebSocket server started at ws://{self.ws_host}:{self.ws_port}")
            await server.wait_closed()
            logger.info("WebSocket server stopped.")


__client__ = ConsoleClient()
