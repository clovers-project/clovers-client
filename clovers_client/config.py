from typing import Literal
from pydantic import BaseModel
from clovers.config import Config as CloversConfig


class Config(BaseModel):
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "DEBUG"
    log_file: str = ""

    @classmethod
    def sync_config(cls):
        __config_dict__: dict = CloversConfig.environ().setdefault("clovers", {})
        __config_dict__.update((__config__ := cls.model_validate(__config_dict__)).model_dump())
        return __config__


__config__ = Config.sync_config()
