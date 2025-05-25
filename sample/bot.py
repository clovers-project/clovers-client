try:
    import bot_init
except ImportError:
    pass
import asyncio
import logging
from clovers.logger import logger
from clovers_client.console import Client as Client


class ColoredFormatter(logging.Formatter):
    COLORS = {
        "INFO": "\033[92m",  # 绿色
        "WARNING": "\033[93m",  # 黄色
        "ERROR": "\033[91m",  # 红色
        "CRITICAL": "\033[91m",  # 红色
        "DEBUG": "\033[96m",  # 青色
        "RESET": "\033[0m",  # 重置颜色
    }

    def __init__(self) -> None:
        super().__init__(f"[%(asctime)s][%(levelname)s]{self.COLORS["RESET"]}%(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    def format(self, record):
        # 添加颜色
        color = self.COLORS.get(record.levelname, self.COLORS["RESET"])
        message = super().format(record)
        return color + message


(console_handler := logging.StreamHandler()).setFormatter(ColoredFormatter())
logger.setLevel(level=logging.DEBUG)
logger.addHandler(console_handler)

asyncio.run(Client().run())
