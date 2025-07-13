from pydantic import BaseModel
from clovers_client.config import Config as BaseConfig


class User(BaseModel):
    user_id: str = "0"
    group_id: str = "0"
    nickname: str = "Master"
    avatar: str = "https://localhost:8080/avatar/0.png"
    group_avatar: str = "https://localhost:8080/group_avatar/0.png"
    permission: int = 3


class Config(BaseConfig):
    master = User()


class Event:
    user: User = Config.sync_config().master
    to_me: bool = False
    at: list[str] = []
    image_list: list[str] = []
    is_private: bool = False
