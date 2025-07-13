from clovers_client.config import Config as BaseConfig


class Config(BaseConfig):
    Bot_Nickname: str = "Bot酱"
    superusers: set[str] = set()
