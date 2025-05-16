import asyncio
from pathlib import Path
from clovers import Leaf, Client as CloversClient
from clovers.utils import list_modules
from .adapter import __adapter__
from .config import Event, __config__

Bot_Nickname = __config__.Bot_Nickname
master = __config__.master


class Client(Leaf, CloversClient):
    def __init__(self, name="CONSOLE"):
        super().__init__(name)
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

    async def run(self):
        async with self:
            while self.running:
                inputs = input("Enter Message:")
                await asyncio.create_task(self.response(inputs=inputs, event=Event(user=master)))
