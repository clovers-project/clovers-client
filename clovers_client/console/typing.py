from typing import TypedDict, Literal, Any, NotRequired
from collections.abc import Callable, Coroutine


class ChatMessage(TypedDict):
    type: Literal["user"]
    text: str
    images: list[str]
    at: list[str]
    senderId: str
    senderName: str
    avatar: str
    groupId: str
    groupName: str
    groupAvatar: str
    permission: Literal["SuperUser", "Owner", "Admin", "Member"]
    messageId: NotRequired[str]


class ConsoleMessage(TypedDict):
    type: Literal["system"]
    data: list


type SendMethod = Callable[[ChatMessage | ConsoleMessage], Coroutine[Any, Any, None]]


class MessageEvent(ChatMessage):
    to_me: bool
    ip: str | None
