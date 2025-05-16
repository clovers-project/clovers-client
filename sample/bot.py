import sys
from pathlib import Path

sys.path.insert(0, Path(__file__).parent.parent.as_posix())
sys.path.insert(0, r"D:\CLOVERS\clovers")
sys.path.insert(0, r"D:\CLOVERS\clovers-divine")
sys.path.insert(0, r"D:\CLOVERS\clovers-leafgame")
sys.path.insert(0, r"D:\CLOVERS\clovers-tabletop-helper")
sys.path.insert(0, r"D:\CLOVERS\clovers-setu-collection")
sys.path.insert(0, r"D:\CLOVERS\clovers-groupmate-waifu")
sys.path.insert(0, r"D:\CLOVERS\clovers-AIchat")

import asyncio
import logging
from clovers.logger import logger

from clovers_client.console import Client as Client

logger.setLevel(level=logging.INFO)
# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(levelname)s]%(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

asyncio.run(Client().run())
