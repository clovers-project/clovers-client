from pydantic import BaseModel
from clovers.config import Config as CloversConfig
from functools import cache


class Config(BaseModel):
    Bot_Nickname: str = "Bot酱"
    superusers: set[str] = set()
    url: str = "http://127.0.0.1:3000"
    ws_url: str = "ws://127.0.0.1:3001"
    adapters: list[str] = ["~adapter"]
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []

    @classmethod
    @cache
    def sync_config(cls):
        __config_dict__: dict = CloversConfig.environ().setdefault("clovers", {})
        __config_dict__.update((__config__ := cls.model_validate(__config_dict__)).model_dump())
        return __config__
