from clovers_client import Config as BaseConfig


class Config(BaseConfig):
    BOT_AVATAR_URL: str = "/download/bot_avatar.png"
    host: str = "127.0.0.1"
    port: int = 11000
    load_dir: str = "./load_dir"
