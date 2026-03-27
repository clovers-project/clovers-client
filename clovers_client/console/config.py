from typing import Literal
from clovers_client import Config as BaseConfig


class Config(BaseConfig):
    LOG_FILE: str = "./log/clovers.log"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "DEBUG"
    BOT_NICKNAME: str = "Bot酱"
    BOT_AVATAR_URL: str = ""
    adapters: list[str] = []
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []
    host: str = "127.0.0.1"
    port: int = 11000
    load_dir: str = "./load_dir"
