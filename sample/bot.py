import sys
from pathlib import Path

sys.path.insert(0, Path(__file__).parent.parent.as_posix())
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

from clovers_client.console import Leaf as console


# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(levelname)s]%(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

asyncio.run(console().run())
