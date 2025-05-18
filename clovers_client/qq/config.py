from pydantic import BaseModel


class Config(BaseModel):
    Bot_Nickname: str = "C酱"
    appid: str = ""
    secret: str = ""
    group_adapters: list[str] = []
    group_adapter_dirs: list[str] = []
    guild_adapters: list[str] = []
    guild_adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []
    superusers: set[str] = set()


from clovers.config import Config as CloversConfig

clovers_config = CloversConfig.environ()

__config__ = Config.model_validate(clovers_config.get("clovers", {}))
clovers_config["clovers"] = __config__.model_dump()
