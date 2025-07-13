from clovers_client.config import Config as BaseConfig


class Config(BaseConfig):
    Bot_Nickname: str = "Bot酱"
    url: str = "http://127.0.0.1:3000"
    ws_url: str = "ws://127.0.0.1:3001"
    adapters: list[str] = ["clover_client.onebot.v11.adapter"]
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []
