from pydantic import BaseModel
from pathlib import Path


class User(BaseModel):
    user_id: str = "0"
    group_id: str = "0"
    nickname: str = "Master"
    avatar: str = "https://localhost:8080/avatar/0.png"
    group_avatar: str = "https://localhost:8080/group_avatar/0.png"
    permission: int = 3


class Config(BaseModel):
    Bot_Nickname: str = "Customer"
    master: User = User()
    plugins: list[str] = []
    plugin_dirs: list[str] = []


class Event(BaseModel):
    to_me: bool = False
    at: list[str] = []
    image_list: list[str] = []
    is_private: bool = False
