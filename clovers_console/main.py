import asyncio
import logging
from pathlib import Path
from clovers import Leaf
from clovers.clovers import list_modules
from clovers.config import config as clovers_config
from clovers.logger import logger
from .data import Config, Event, User

# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(levelname)s]%(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

config = Config.model_validate(clovers_config.get("clovers", {}))
clovers_config["clovers"] = config.model_dump()
Bot_Nickname = config.Bot_Nickname
master = config.master
others = User(
    group_id=master.group_id,
    avatar=master.avatar,
    nickname="M酱",
    group_avatar=master.group_avatar,
    permission=1,
)

leaf = Leaf("console")


@leaf.adapter.property_method("Bot_Nickname")
async def _():
    return Bot_Nickname


async def run():
    global leaf, master, others, clovers_config
    clovers_config.save()
    leaf.load_adapter("clovers_console.adapter")
    for plugin in config.plugins:
        leaf.load_plugin(plugin)
    for plugin_dir in config.plugin_dirs:
        plugin_dir = Path(plugin_dir)
        if plugin_dir.exists():
            for plugin in list_modules(plugin_dir):
                leaf.load_plugin(plugin)
        else:
            plugin_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"创建插件目录 {plugin_dir}")

    await asyncio.create_task(leaf.startup())
    while (input_str := input("> ")) != "exit":
        event = {}
        user = master
        if input_str.startswith(Bot_Nickname):
            input_str = input_str[len(Bot_Nickname) :]
            event["to_me"] = True
        input_str = input_str.split(" --args", 1)
        image_list = []
        at = []
        if len(input_str) == 2:
            input_str, args = input_str
            args = args.split()
            for arg in args:
                if arg.startswith("image:"):
                    image_list.append(arg[6:])
                elif arg.startswith("at:"):
                    at.append(arg[3:])
                elif arg == "private":
                    event["is_private"] = True
                elif arg == "others":
                    user = others
        else:
            input_str = input_str[0]
        event["image_list"] = image_list
        event["at"] = at
        await asyncio.create_task(
            leaf.response(
                input_str,
                user=user,
                event=Event(**event),
            )
        )
    await asyncio.create_task(leaf.shutdown())
