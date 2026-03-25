import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from clovers.logger import logger
from .config import __config__

if __config__.log_file:
    log_file = Path(__config__.log_file)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(__config__.log_file, maxBytes=1024 * 1024 * 10, backupCount=10, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("[%(asctime)s][%(levelname)s][%(name)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
    file_handler.setLevel(logging.INFO)

match __config__.log_level.upper():
    case "DEBUG":
        logger.setLevel(logging.DEBUG)
    case "WARNING":
        logger.setLevel(logging.WARNING)
    case "ERROR":
        logger.setLevel(logging.ERROR)
    case "CRITICAL":
        logger.setLevel(logging.CRITICAL)
    case _:
        logger.setLevel(logging.INFO)


COLORS = {
    "INFO": "\033[92m",  # 绿色
    "WARNING": "\033[93m",  # 黄色
    "ERROR": "\033[91m",  # 红色
    "CRITICAL": "\033[91m",  # 红色
    "DEBUG": "\033[96m",  # 青色
    "RESET": "\033[0m",  # 重置颜色
}


class ColoredFormatter(logging.Formatter):

    def __init__(self) -> None:
        super().__init__(f"[%(asctime)s][%(levelname)s]{COLORS["RESET"]}%(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    def format(self, record):
        # 添加颜色
        color = COLORS.get(record.levelname, COLORS["RESET"])
        message = super().format(record)
        return color + message


console_handler = logging.StreamHandler()
console_handler.setFormatter(ColoredFormatter())
logger.addHandler(console_handler)
