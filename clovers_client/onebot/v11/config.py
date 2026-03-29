from clovers_client.config import Config as BaseConfig


class Config(BaseConfig):
    SUPERUSERS: set[str] = set()
    ws_url: str = "ws://127.0.0.1:3001"
    ws_token: str | None = None
