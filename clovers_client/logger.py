import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

COLORS = {
    "INFO": "\033[92m",  # 绿色
    "WARNING": "\033[93m",  # 黄色
    "ERROR": "\033[91m",  # 红色
    "CRITICAL": "\033[91m",  # 红色
    "DEBUG": "\033[96m",  # 青色
    "RESET": "\033[0m",  # 重置颜色
}

LOG_LEVEL = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


class ColoredFormatter(logging.Formatter):

    def __init__(self) -> None:
        super().__init__(f"[%(asctime)s][%(levelname)s]{COLORS["RESET"]}%(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    def format(self, record):
        # 添加颜色
        color = COLORS.get(record.levelname, COLORS["RESET"])
        message = super().format(record)
        return color + message


def init_logger(logger: logging.Logger, log_file: str | None = None, log_level: str = "INFO"):
    logger.handlers.clear()
    level = LOG_LEVEL.get(log_level, logging.INFO)
    logger.setLevel(level)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(ColoredFormatter())
    console_handler.setLevel(level)
    logger.addHandler(console_handler)
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(log_file, maxBytes=1024 * 1024 * 10, backupCount=10, encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("[%(asctime)s][%(levelname)s][%(name)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
        file_handler.setLevel(logging.INFO)
        logger.addHandler(file_handler)
    return logger
