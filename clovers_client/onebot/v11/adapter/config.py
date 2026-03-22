from clovers_client.config import Config as BaseConfig


class Config(BaseConfig):
    Bot_Nickname: str = "Bot酱"
    superusers: set[str] = set()


__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname
SUPERUSERS = __config__.superusers
