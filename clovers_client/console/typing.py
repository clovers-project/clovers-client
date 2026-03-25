from typing import TypedDict, Literal, Any
from collections.abc import Callable, Coroutine


class ChatMessage(TypedDict):
    type: Literal["user"]
    at: list[str]
    text: str
    images: list[str]
    senderId: str
    senderName: str
    avatar: str
    groupId: str
    groupAvatar: str
    permission: Literal["SuperUser", "Owner", "Admin", "Member"]


class ConsoleMessage(TypedDict):
    type: Literal["system"]
    data: list


type SendFunction = Callable[[str], Coroutine[Any, Any, None]]


class MessageEvent(ChatMessage):
    to_me: bool
    bot_nickname: str
    bot_avatar: str
    ip: str | None
