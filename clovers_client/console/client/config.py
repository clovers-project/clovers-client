from clovers_client.config import Config as BaseConfig
from ..typing import User


class Config(BaseConfig):
    Bot_Nickname: str = "Bot酱"
    adapters: list[str] = ["clovers_client.console.adapter"]
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []
    ws_host: str = "127.0.0.1"
    ws_port: int = 11000
    master: User = User()
