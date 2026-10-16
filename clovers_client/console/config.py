from clovers_client.config import ClientConfig


class Config(ClientConfig):
    BOT_AVATAR_URL: str = "/download/bot_avatar.png"
    host: str = "127.0.0.1"
    port: int = 11000
    message_history_limit: int = 1000
    data_dir: str = "./data/CloversConsole"
