from clovers import EventProtocol
from collections.abc import Coroutine
from typing import Any, TypedDict, Protocol, Literal, overload
from .result import FileLike, ListMessage, GroupMessage, PrivateMessage, OverallResult

type AsyncFunction[T] = Coroutine[Any, Any, T]
type OptionalCall[T] = AsyncFunction[T | None] | None


class MemberInfo(TypedDict):
    group_id: str
    user_id: str
    nickname: str
    card: str
    avatar: str
    last_sent_time: int


class FlatContextUnit(TypedDict):
    nickname: str
    user_id: str
    text: str
    images: list[str]


class Event(EventProtocol, Protocol):
    user_id: str
    """用户唯一ID"""
    group_id: str | None
    """群组唯一ID，为空时为私聊"""
    nickname: str
    """用户昵称"""
    to_me: bool
    """是否为针对我的事件"""
    image_list: list[str]
    """消息中包含的图片 URL 列表"""
    avatar: str
    """用户头像 URL"""
    group_avatar: str | None
    """群组头像 URL"""
    permission: Literal[0, 1, 2, 3]
    """权限等级\n
    0: 无权限\n
    1: 管理员\n
    2: 群主\n
    3: 超级管理员
    """
    flat_context: list[FlatContextUnit]
    """引用的转发聊天记录的平铺展示"""

    @overload
    async def call(self, key: Literal["text"], message: str): ...

    @overload
    async def call(self, key: Literal["image"], message: FileLike): ...

    @overload
    async def call(self, key: Literal["list"], message: ListMessage): ...

    @overload
    async def call(self, key: Literal["group_message"], message: GroupMessage): ...

    @overload
    async def call(self, key: Literal["private_message"], message: PrivateMessage): ...

    @overload
    async def call(self, key: Literal["merge_forward"], message: list[OverallResult]): ...

    @overload
    def call(self, key: Literal["flat_context"]) -> OptionalCall[list[FlatContextUnit]]: ...

    @overload
    def call(self, key: Literal["group_member_info"], group_id: str, user_id: str) -> OptionalCall[MemberInfo]: ...

    @overload
    def call(self, key: Literal["group_member_list"], group_id: str) -> OptionalCall[list[MemberInfo]]: ...
