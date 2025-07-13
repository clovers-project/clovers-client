from clovers_client.config import Config as BaseConfig


class Config(BaseConfig):
    Bot_Nickname: str = "Bot酱"
    adapters: list[str] = ["clover_client.console.adapter"]
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []
    ws_port: int = 11000
