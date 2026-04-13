from clovers import EventType
from typing import TypedDict, Protocol, Literal, Any, overload
from collections.abc import Coroutine
from .result import FileLike, SequenceMessage, SegmentedResult, GroupMessage, PrivateMessage, MergeForwardMessage

type OptCoro[T] = Coroutine[Any, Any, T] | None
type PermissionLiteral = Literal[0, 1, 2, 3]


class MemberInfo(TypedDict):
    user_id: str
    group_id: str
    nickname: str
    card: str
    avatar: str
    last_sent_time: int


class FlatContextUnit(TypedDict):
    nickname: str
    user_id: str
    text: str
    images: list[str]


class Event(EventType, Protocol):
    to_me: bool
    """是否为针对我的事件"""
    at: list[str]
    """消息中包含的 @ 的用户 ID 列表"""
    image_list: list[str]
    """消息中包含的图片 URL 列表"""
    user_id: str
    """用户唯一ID"""
    nickname: str
    """用户昵称"""
    avatar: str
    """用户头像 URL"""
    group_id: str | None
    """群组唯一ID，为空时为私聊"""
    group_avatar: str | None
    """群组头像 URL"""
    bot_nickname: str
    """机器人昵称"""
    permission: PermissionLiteral
    """权限等级\n
    0: 无权限\n
    1: 管理员\n
    2: 群主\n
    3: 超级管理员
    """
    flat_context: list[FlatContextUnit] | None

    @overload
    async def send(self, key: Literal["at"], message: str): ...
    @overload
    async def send(self, key: Literal["text"], message: str): ...
    @overload
    async def send(self, key: Literal["image"], message: FileLike): ...
    @overload
    async def send(self, key: Literal["list"], message: SequenceMessage): ...
    @overload
    async def send(self, key: Literal["voice"], message: FileLike): ...
    @overload
    async def send(self, key: Literal["video"], message: FileLike): ...
    @overload
    async def send(self, key: Literal["file"], message: FileLike): ...
    @overload
    async def send(self, key: Literal["console"], message: list[str]): ...
    @overload
    async def send(self, key: Literal["segmented"], message: SegmentedResult): ...
    @overload
    async def send(self, key: Literal["private_message"], message: PrivateMessage): ...
    @overload
    async def send(self, key: Literal["group_message"], message: GroupMessage): ...
    @overload
    async def send(self, key: Literal["merge_forward"], message: MergeForwardMessage): ...
    def send(self, key: str, message: Any):
        raise NotImplementedError

    @overload
    def call(self, key: Literal["flat_context"]) -> OptCoro[list[FlatContextUnit]]: ...
    @overload
    def call(self, key: Literal["group_member_info"], group_id: str, user_id: str) -> OptCoro[MemberInfo]: ...
    @overload
    def call(self, key: Literal["group_member_list"], group_id: str) -> OptCoro[list[MemberInfo]]: ...
    def call(self, key: str, *args: Any, **kwargs):
        raise NotImplementedError
