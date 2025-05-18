from pydantic import BaseModel


class Config(BaseModel):
    Bot_Nickname: str = "C酱"
    superusers: set[str] = set()
    url: str = "http://127.0.0.1:3000"
    ws_url: str = "ws://127.0.0.1:3001"
    adapters: list[str] = []
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []


from clovers.config import Config as CloversConfig

clovers_config = CloversConfig.environ()

__config__ = Config.model_validate(clovers_config.get("clovers", {}))
clovers_config["clovers"] = __config__.model_dump()
