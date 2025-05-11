from pydantic import BaseModel
from .data import User


class Config(BaseModel):
    Bot_Nickname: str = "C酱"
    plugins: list[str] = []
    plugin_dirs: list[str] = []
    superusers: list[str] = []
    url: str = "http://127.0.0.1:3000"
    ws_url: str = "ws://127.0.0.1:3001"
    master: User = User()


from clovers.config import config as clovers_config

__config__ = Config.model_validate(clovers_config.get("clovers", {}))
clovers_config["clovers"] = __config__.model_dump()
