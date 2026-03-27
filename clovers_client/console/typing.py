from typing import TypedDict, Literal, Any
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
    groupAvatar: str
    permission: Literal["SuperUser", "Owner", "Admin", "Member"]


class ConsoleMessage(TypedDict):
    type: Literal["system"]
    data: list


type SendFunction = Callable[[str], Coroutine[Any, Any, None]]
type UploadFile = Callable[[bytes], str]


class MessageEvent(ChatMessage):
    to_me: bool
    bot_nickname: str
    bot_avatar: str
    ip: str | None


CONSOLE_PREFIX = b"\x05\x03\x01".decode()
