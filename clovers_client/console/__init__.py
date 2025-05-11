import asyncio
from clovers import Leaf
from .data import Event
from .config import __config__

Bot_Nickname = __config__.Bot_Nickname
master = __config__.master


class MyLeaf(Leaf):
    @staticmethod
    def extract_message(inputs: str, event: Event, **ignore):
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
        asyncio.create_task(self.startup())
        while (inputs := input("Enter message: ")) != "exit":
            await asyncio.create_task(self.response(inputs=inputs, user=master, event=Event()))
        await asyncio.create_task(self.shutdown())
