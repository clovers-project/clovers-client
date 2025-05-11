import sys

sys.path.insert(0, r"D:\CLOVERS\clovers")
sys.path.insert(0, r"D:\CLOVERS\clovers-apscheduler")
sys.path.insert(0, r"D:\CLOVERS\clovers-divine")
sys.path.insert(0, r"D:\CLOVERS\clovers-leafgame")
sys.path.insert(0, r"D:\CLOVERS\clovers-tabletop-helper")
sys.path.insert(0, r"D:\CLOVERS\clovers-setu-collection")
sys.path.insert(0, r"D:\CLOVERS\clovers-groupmate-waifu")
sys.path.insert(0, r"D:\CLOVERS\clovers-AIchat")

import logging
import asyncio
from pathlib import Path
from clovers.clovers import list_modules
from clovers.logger import logger

# from clovers_client.onebot_v11 import MyLeaf
# from clovers_client.onebot_v11 import __config__ as config
# from clovers_client.onebot_v11.adapter import __adapter__ as adapter
from clovers_client.console import MyLeaf
from clovers_client.console import __config__ as config
from clovers_client.console.adapter import __adapter__ as adapter


# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(levelname)s]%(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

leaf = MyLeaf(adapter.name)
leaf.adapter.update(adapter)


@leaf.adapter.property_method("Bot_Nickname")
async def _():
    return config.Bot_Nickname


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

asyncio.run(leaf.run())
