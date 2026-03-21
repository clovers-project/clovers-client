from typing import TypedDict, Literal
from pydantic import BaseModel


class ChatMessage(TypedDict, total=False):
    type: Literal["user"]
    text: str
    images: list[str]
    senderId: str
    senderName: str
    avatar: str
    groupId: str
    groupAvatar: str
    permission: Literal["SuperUser", "Owner", "Admin", "Member"]


type JsonBaseType = str | int | float | bool | None


class ConsoleMessage(TypedDict, total=False):
    type: Literal["system"]
    data: list[JsonBaseType]


class User(BaseModel):
    user_id: str = "0"
    group_id: str = "0"
    nickname: str = "Master"
    avatar: str = "https://localhost:8080/avatar/0.png"
    group_avatar: str = "https://localhost:8080/group_avatar/0.png"
    permission: int = 3


class Event:
    def __init__(self, user: User):
        self.user = user
        self.to_me: bool = False
        self.at: list[str] = []
        self.image_list: list[str] = []
        self.is_private: bool = False
