from typing import TypedDict, Literal, NotRequired

type PermissionLiteral = Literal["SuperUser", "Owner", "Admin", "Member"]


class SenderInfo(TypedDict):
    senderId: str
    senderName: str
    avatar: str
    permission: PermissionLiteral


class GroupInfo(TypedDict):
    groupId: str
    groupName: str
    groupAvatar: str


class BaseMessage(TypedDict):
    type: str
    messageId: NotRequired[str]
    echo: NotRequired[str]


class ChatMessage(BaseMessage, GroupInfo, SenderInfo):
    type: Literal["user"]
    text: str
    images: list[str]
    at: list[str]


class ConsoleMessage(BaseMessage):
    type: Literal["system"]
    data: list[str]


type Message = ChatMessage | ConsoleMessage


class MessageEvent(ChatMessage):
    to_me: bool
    ip: str | None
