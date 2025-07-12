import sys
import subprocess
import asyncio
import websockets
from pathlib import Path
from clovers.logger import logger
from clovers import Client as CloversClient
from clovers_client import init_logger, Leaf
from .config import Config, User

init_logger()

__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname
LEN_BOT_NICKNAME = len(BOT_NICKNAME)


class Event:
    user: User = __config__.master
    to_me: bool = False
    at: list[str] = []
    image_list: list[str] = []
    is_private: bool = False


class Client(Leaf, CloversClient):
    def __init__(self):
        super().__init__("CONSOLE")
        self.ws_port = __config__.ws_port
        self.keep_to_me = True
        self.load_adapters_from_list(__config__.adapters)
        self.load_adapters_from_dirs(__config__.adapter_dirs)
        self.load_plugins_from_list(__config__.plugins)
        self.load_plugins_from_dirs(__config__.plugin_dirs)

    def extract_message(self, inputs: str, event: Event, **ignore):
        if inputs == "/":
            self.keep_to_me = not self.keep_to_me
            logger.info(f"Keep to me mode: {self.keep_to_me}")
            return
        if inputs.startswith(BOT_NICKNAME):
            inputs = inputs[LEN_BOT_NICKNAME:].lstrip()
            event.to_me = True
        args = inputs.split(" --args", 1)
        if len(args) == 2:
            inputs, args = args
            for arg in args.split():
                if arg.startswith("image:"):
                    event.image_list.append(arg[6:])
                elif arg.startswith("at:"):
                    event.at.append(arg[3:])
                elif arg == "private":
                    event.is_private = True
        event.to_me = event.to_me or self.keep_to_me
        return inputs

    async def main_loop(self, ws_connect: websockets.connect):
        while self.running:
            try:
                async for recv in (ws := await ws_connect):
                    asyncio.create_task(self.response(inputs=recv, event=Event(), ws_connect=ws))
            except websockets.exceptions.ConnectionClosedError:
                break

    async def run(self):
        subprocess.Popen(
            [sys.executable, (Path(__file__).parent / "console.py").as_posix(), str(self.ws_port)],
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )
        async with self:
            ws_connect = websockets.connect(f"ws://127.0.0.1:{self.ws_port}")
            await self.main_loop(ws_connect)
