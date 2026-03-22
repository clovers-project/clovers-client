from pathlib import Path
from collections.abc import AsyncGenerator
from typing import TypedDict, Protocol, Literal, overload
from io import BytesIO
from ..typing import MessageSegmentSend, MessageSegmentReveive, Sender, Node, GroupMessageEvent, MemberInfo as OneBotV11MemberInfo

type FileLike = str | bytes | BytesIO | Path


class AtResult(Protocol):
    key: Literal["at"]
    data: str


class TextResult(Protocol):
    key: Literal["text"]
    data: str


class FaceResult(Protocol):
    key: Literal["face"]
    data: int


class ImageResult(Protocol):
    key: Literal["image"]
    data: FileLike


class VoiceResult(Protocol):
    key: Literal["voice"]
    data: FileLike


class VideoResult(Protocol):
    key: Literal["video"]
    data: FileLike


type SingleResult = AtResult | TextResult | FaceResult | ImageResult | VoiceResult | VideoResult
type ListMessage = list[SingleResult]


class ListResult(Protocol):
    key: Literal["list"]
    data: ListMessage


type OverallResult = SingleResult | ListResult
type SegmentedMessage = AsyncGenerator[OverallResult, None]


class SegmentedResult(Protocol):
    key: Literal["segmented"]
    data: SegmentedMessage


type Result = SingleResult | ListResult | SegmentedResult


class GroupMessage(TypedDict):
    group_id: str
    data: Result


class PrivateMessage(TypedDict):
    user_id: str
    data: Result


class FlatContextUnit(TypedDict):
    nickname: str
    user_id: str
    text: str
    images: list[str]


class SendPrivateMsgBody(TypedDict):
    user_id: int
    message: list[MessageSegmentSend]


class SendGroupMsgBody(TypedDict):
    group_id: int
    message: list[MessageSegmentSend]


class SendPrivateForwardMsgBody(TypedDict):
    user_id: int
    messages: list[Node]


class SendGroupForwardMsgBody(TypedDict):
    group_id: int
    messages: list[Node]


class ForwardNodeData(TypedDict, total=False):
    content: list[MessageSegmentReveive]
    sender: Sender


class APIResponse[DataType](TypedDict):
    status: str
    retcode: int
    message: str
    wording: str
    data: DataType


class Response[DataType](Protocol):

    def json(self) -> APIResponse[DataType]: ...


class UserIDAndGroupIDBody(TypedDict):
    group_id: int
    user_id: int


class MemberInfo(TypedDict):
    group_id: str
    user_id: str
    nickname: str
    card: str
    avatar: str
    last_sent_time: int


class Post(Protocol):

    # @overload
    # async def __call__(self, endpoint: str, **kwargs): ...

    @overload
    async def __call__(self, endpoint: Literal["send_private_msg"], json: SendPrivateMsgBody, **kwargs): ...

    @overload
    async def __call__(self, endpoint: Literal["send_group_msg"], json: SendGroupMsgBody, **kwargs): ...

    @overload
    async def __call__(self, endpoint: Literal["send_private_forward_msg"], json: SendPrivateForwardMsgBody, **kwargs): ...

    @overload
    async def __call__(self, endpoint: Literal["send_group_forward_msg"], json: SendGroupForwardMsgBody, **kwargs): ...

    @overload
    async def __call__(
        self, endpoint: Literal["get_msg"], json: dict[Literal["message_id"], str], **kwargs
    ) -> Response[GroupMessageEvent]: ...

    @overload
    async def __call__(
        self, endpoint: Literal["get_forward_msg"], json: dict[Literal["message_id"], str], **kwargs
    ) -> Response[dict[Literal["messages"], list[ForwardNodeData]]]: ...

    @overload
    async def __call__(
        self, endpoint: Literal["get_group_member_info"], json: UserIDAndGroupIDBody, **kwargs
    ) -> Response[OneBotV11MemberInfo]: ...

    @overload
    async def __call__(
        self, endpoint: Literal["get_group_member_list"], json: dict[Literal["group_id"], int], **kwargs
    ) -> Response[list[OneBotV11MemberInfo]]: ...
