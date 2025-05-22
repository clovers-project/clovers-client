import sys
import subprocess
import asyncio
import websockets
from pathlib import Path
from clovers import LeafClient
from clovers.utils import list_modules
from .adapter import __adapter__
from .config import Event, __config__

Bot_Nickname = __config__.Bot_Nickname
master = __config__.master
ws_port = __config__.ws_port


class Client(LeafClient):
    def __init__(self, name="CONSOLE", ws_port=ws_port):
        super().__init__(name)
        self.ws_port = ws_port
        self.adapter.update(__adapter__)
        for plugin in __config__.plugins:
            self.load_plugin(plugin)
        for plugin_dir in __config__.plugin_dirs:
            plugin_dir = Path(plugin_dir)
            if not plugin_dir.exists():
                plugin_dir.mkdir(parents=True, exist_ok=True)
                continue
            for plugin in list_modules(plugin_dir):
                self.load_plugin(plugin)

    def extract_message(self, inputs: str, event: Event, **ignore):
        if inputs == "exit":
            self.running = False
            return
        if inputs.startswith(Bot_Nickname):
            inputs = inputs.lstrip(Bot_Nickname)
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
        return inputs

    def inputs_console(self):
        subprocess.Popen(
            [sys.executable, (Path(__file__).parent / "console.py").as_posix(), str(self.ws_port)],
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )

    async def main_loop(self, ws_connect: websockets.connect):
        while self.running:
            try:
                async for recv in await ws_connect:
                    asyncio.create_task(self.response(inputs=recv, event=Event(user=master)))
            except websockets.exceptions.ConnectionClosedError:
                break

    async def run(self):
        self.inputs_console()
        async with self:
            ws_connect = websockets.connect(f"ws://127.0.0.1:{self.ws_port}")
            await self.main_loop(ws_connect)
