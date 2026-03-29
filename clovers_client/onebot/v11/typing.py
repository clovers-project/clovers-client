from typing import TypedDict, Literal, NotRequired, Protocol, overload


class At(TypedDict):
    type: Literal["at"]
    data: dict[Literal["qq"], str]


class Text(TypedDict):
    type: Literal["text"]
    data: dict[Literal["text"], str]


class Face(TypedDict):
    type: Literal["face"]
    data: dict[Literal["id"], int]


class ImageRecv(TypedDict):
    type: Literal["image"]
    data: dict[Literal["url"], str]


class ImageSend(TypedDict):
    type: Literal["image"]
    data: dict[Literal["file"], str]


class VoiceRecv(TypedDict):
    type: Literal["record"]
    data: dict[Literal["url"], str]


class VoiceSend(TypedDict):
    type: Literal["record"]
    data: dict[Literal["file"], str]


class VideoRecv(TypedDict):
    type: Literal["video"]
    data: dict[Literal["url"], str]


class VideoSend(TypedDict):
    type: Literal["video"]
    data: dict[Literal["file"], str]


class Quote(TypedDict):
    """引用（回复）的消息
    id: 引用的消息id
    """

    type: Literal["reply"]
    data: dict[Literal["id"], str]


class ChatContext(TypedDict):
    """转发聊天记录
    id: 消息id
    """

    type: Literal["forward"]
    data: dict[Literal["id"], str]


type MessageSegmentReveive = At | Text | Face | ImageRecv | VoiceRecv | VideoRecv | Quote | ChatContext
type MessageSegmentSend = At | Text | Face | ImageSend | VoiceSend | VideoSend | Quote


class NodeData(TypedDict):
    """转发聊天记录节点数据
    uin: QQ号
    name: 显示名
    content: 节点内容
    """

    uin: int
    name: str
    content: list[MessageSegmentSend]


class Node(TypedDict):
    """转发聊天记录节点
    id: 节点id
    """

    type: Literal["node"]
    data: NodeData


class BaseMessageEvent(TypedDict):
    time: int
    self_id: int
    post_type: Literal["message"]
    message_id: int
    user_id: int
    message: list[MessageSegmentReveive]
    raw_message: str
    to_me: bool  # 此字段为内部字段，非 OneBot V11 定义
    BOT_NICKNAME: str  # 此字段为内部字段，非 OneBot V11 定义
    SUPERUSERS: set[str]  # 此字段为内部字段，非 OneBot V11 定义


class Sender(TypedDict):
    user_id: int
    nickname: str
    sex: Literal["male", "female", "unknown"]
    age: int


class PrivateMessageEvent(BaseMessageEvent):
    message_type: Literal["private"]
    sub_type: Literal["friend", "group", "other"]
    sender: Sender


class Member(Sender):
    card: str
    area: str
    level: str
    role: Literal["owner", "admin", "member"]
    title: str


class MemberInfo(Member):
    group_id: int
    qq_level: int
    join_time: int
    last_sent_time: int
    is_robot: NotRequired[bool]


class GroupMessageEvent(BaseMessageEvent):
    message_type: Literal["group"]
    sub_type: Literal["normal", "notice"]
    group_id: int
    sender: Member


type MessageEvent = PrivateMessageEvent | GroupMessageEvent
type Message = list[MessageSegmentSend]


class APIResponse[DataType](TypedDict):
    status: str
    retcode: int
    data: DataType
    echo: str


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


class UserIDAndGroupIDBody(TypedDict):
    group_id: int
    user_id: int


class OneBotV11API(Protocol):

    @overload
    async def __call__(self, endpoint: Literal["send_private_msg"], params: SendPrivateMsgBody) -> None: ...

    @overload
    async def __call__(self, endpoint: Literal["send_group_msg"], params: SendGroupMsgBody) -> None: ...

    @overload
    async def __call__(self, endpoint: Literal["send_private_forward_msg"], params: SendPrivateForwardMsgBody) -> None: ...

    @overload
    async def __call__(self, endpoint: Literal["send_group_forward_msg"], params: SendGroupForwardMsgBody) -> None: ...

    @overload
    async def __call__(
        self,
        endpoint: Literal["get_msg"],
        params: dict[Literal["message_id"], str],
        need_response: Literal[True],
    ) -> GroupMessageEvent: ...

    @overload
    async def __call__(
        self,
        endpoint: Literal["get_forward_msg"],
        params: dict[Literal["message_id"], str],
        need_response: Literal[True],
    ) -> dict[Literal["messages"], list[ForwardNodeData]]: ...

    @overload
    async def __call__(
        self,
        endpoint: Literal["get_group_member_info"],
        params: UserIDAndGroupIDBody,
        need_response: Literal[True],
    ) -> MemberInfo: ...

    @overload
    async def __call__(
        self,
        endpoint: Literal["get_group_member_list"],
        params: dict[Literal["group_id"], int],
        need_response: Literal[True],
    ) -> list[MemberInfo]: ...
