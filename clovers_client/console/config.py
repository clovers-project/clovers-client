from clovers_client.config import ClientConfig


class Config(ClientConfig):
    BOT_AVATAR_URL: str = "/download/bot_avatar.png"
    host: str = "127.0.0.1"
    port: int = 11000
    load_dir: str = "./load_dir"
    public_sessions: list[str] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
    message_history_limit: int = 1000
