from typing import Literal
from pydantic import BaseModel
from clovers.config import Config as CloversConfig


class Config(BaseModel):
    ...

    @classmethod
    def sync_config(cls, config_key: str = "clovers"):
        __clovers_config__: dict = CloversConfig.environ().setdefault(config_key, {})
        __clovers_config__.update((__config__ := cls.model_validate(__clovers_config__)).model_dump())
        return __config__


class ClientConfig(Config):
    LOG_FILE: str = "./log/clovers.log"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "DEBUG"
    BOT_NICKNAME: str = "Bot酱"
    adapters: list[str] = []
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []
