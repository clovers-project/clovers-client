import sys
from pathlib import Path

sys.path.insert(0, Path(__file__).parent.parent.as_posix())

import asyncio
import logging
from clovers.logger import logger
from clovers.config import Config
from clovers_client.qq import Client as Client

logger.setLevel(level=logging.INFO)
# 配置日志记录器
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(levelname)s]%(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

Config.environ().save()

asyncio.run(Client().run())
