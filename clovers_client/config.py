from pydantic import BaseModel
from clovers.config import Config as CloversConfig


class Config(BaseModel):
    ...

    @classmethod
    def sync_config(cls):
        __config_dict__: dict = CloversConfig.environ().setdefault("clovers", {})
        __config_dict__.update((__config__ := cls.model_validate(__config_dict__)).model_dump())
        return __config__
