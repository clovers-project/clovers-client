import logging
from clovers.logger import logger

logger.setLevel(logging.DEBUG)
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
