import sys
import subprocess
import asyncio
import websockets
from clovers import Leaf, Client
from clovers_client.logger import logger
from ..event import Event
from .script import SCRIPT_PATH
from .config import Config

__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname
LEN_BOT_NICKNAME = len(BOT_NICKNAME)
MASTER = __config__.master


class ConsoleClient(Leaf, Client):
    def __init__(self):
        super().__init__("CONSOLE")
        self.ws_host = __config__.ws_host
        self.ws_port = __config__.ws_port
        self.is_local = self.ws_host.startswith("127.") or self.ws_host == "localhost"
        self.keep_to_me = True
        self.load_adapters_from_list(__config__.adapters)
        self.load_adapters_from_dirs(__config__.adapter_dirs)
        self.load_plugins_from_list(__config__.plugins)
        self.load_plugins_from_dirs(__config__.plugin_dirs)

    def extract_message(self, inputs: str, event: Event, **ignore):
        logger.info(f"Receive: {inputs}")
        if inputs == "/tome":
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

    def run_server(self):
        logger.info(f"Starting local console server ...")
        kwargs = {
            "args": [sys.executable, SCRIPT_PATH, str(self.ws_port), MASTER.nickname],
            "stderr": subprocess.PIPE,
        }
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        return subprocess.Popen(**kwargs)

    async def run(self):
        ws_url = f"ws://{self.ws_host}:{self.ws_port}"
        if self.is_local:
            self.run_server()
        async with self:
            while self.running:
                try:
                    ws_connect = await websockets.connect(ws_url, ping_interval=30, ping_timeout=10)
                    logger.info("WebSocket connected")
                    async for recv_data in ws_connect:
                        asyncio.create_task(self.response(inputs=recv_data, event=Event(MASTER), ws_connect=ws_connect))
                    logger.info("Client closed")
                    return
                except (websockets.exceptions.ConnectionClosedError, TimeoutError):
                    logger.error("WebSocket reconnecting...")
                except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError):
                    if self.is_local and input("Do you want to start the local server? [Y/N]") in "yY":
                        self.run_server()
                except Exception:
                    logger.exception("Error")
                    return


__client__ = ConsoleClient()
