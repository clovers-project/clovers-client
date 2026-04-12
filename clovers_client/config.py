from typing import Literal
from pydantic import BaseModel
from clovers.config import Config as CloversConfig


class Config(BaseModel):
    ...

    @classmethod
    def sync_config(cls, config_key: str):
        clovers_config: dict = CloversConfig.environ().setdefault(config_key, {})
        clovers_config.update((__config := cls.model_validate(clovers_config)).model_dump())
        return __config


class ClientConfig(Config):
    LOG_FILE: str = "./log/clovers.log"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "DEBUG"
    BOT_NICKNAME: str = "Bot酱"
    adapters: list[str] = []
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []
