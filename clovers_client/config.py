from typing import Literal
from pydantic import BaseModel
from clovers.config import Config as CloversConfig


class Config(BaseModel):
    LOG_FILE: str = "./log/clovers.log"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "DEBUG"
    BOT_NICKNAME: str = "Bot酱"
    adapters: list[str] = []
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []

    @classmethod
    def sync_config(cls):
        __config_dict__: dict = CloversConfig.environ().setdefault("clovers", {})
        __config_dict__.update((__config__ := cls.model_validate(__config_dict__)).model_dump())
        return __config__
