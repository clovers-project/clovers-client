from pydantic import BaseModel
from clovers.config import config as clovers_config


class Config(BaseModel):
    Bot_Nickname: str = "C酱"
    plugins: list[str] = []
    plugin_dirs: list[str] = []
    superusers: list[str] = []
    url: str = "http://127.0.0.1:3000"
    ws_url: str = "ws://127.0.0.1:3001"


__config__ = Config.model_validate(clovers_config.get("clovers", {}))
clovers_config["clovers"] = __config__.model_dump()
