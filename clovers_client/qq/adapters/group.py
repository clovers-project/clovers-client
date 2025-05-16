from pathlib import Path
from io import BytesIO
from botpy.message import GroupMessage
from clovers import Adapter
from .typing import ListMessage, SegmentedMessage, FileLike
from ..config import __config__

Bot_Nickname = __config__.Bot_Nickname
superusers = __config__.superusers

adapter = Adapter()


@adapter.send_method("at")
async def _(data: str, event: GroupMessage):
    if data == event.author.member_openid:
        await event.reply()


@adapter.send_method("text")
async def _(data: str, event: GroupMessage):
    await event.reply(content=data)


def to_image(data: FileLike):
    kwargs = {}
    if isinstance(data, str):
        kwargs["media"] = {"file_type": 1, "url": data}
        return kwargs
    if isinstance(data, Path):
        img_bytes = data.read_bytes()
    elif isinstance(data, BytesIO):
        img_bytes = data.getvalue()
    elif isinstance(data, bytes):
        img_bytes = data
    else:
        raise TypeError("Unsupported type")
    kwargs["file_image"] = img_bytes
    return kwargs


@adapter.send_method("image")
async def _(data: FileLike, event: GroupMessage):
    await event.reply(**to_image(data))


@adapter.send_method("voice")
async def _(data: str, event: GroupMessage):
    """发送音频消息"""
    await event.reply(media={"file_type": 3, "url": data})


@adapter.send_method("list")
async def _(data: ListMessage, event: GroupMessage):
    """发送图片文本混合信息"""
    content = ""
    image = None
    for seg in data:
        match seg.send_method:
            case "text":
                content += seg.data
            case "image":
                image = seg.data
    if not image:
        await event.reply(content=content)
    else:
        await event.reply(content=content, **to_image(image))


@adapter.send_method("segmented")
async def _(data: SegmentedMessage):
    """发送分段信息"""
    async for seg in data:
        await adapter.sends_lib[seg.send_method](seg.data)


# @adapter.property_method("send_group_message")
# async def _(data: Result, client: Client, event: GroupMessage) -> Callable[[str, Result], Coroutine]:
#     pass


@adapter.property_method("Bot_Nickname")
async def _():
    return Bot_Nickname


@adapter.property_method("user_id")
async def _(event: GroupMessage):
    return event.author.member_openid


@adapter.property_method("group_id")
async def _(event: GroupMessage):
    return event.group_openid


@adapter.property_method("to_me")
async def _(to_me: bool):
    return to_me


@adapter.property_method("nickname")
async def _(event: GroupMessage):
    return event.author.member_openid


# @adapter.property_method("avatar")
# async def _(event: GroupMessage) -> str:
#     return ""


# @adapter.property_method("group_avatar")
# async def _(event: GroupMessage) -> str:
#     return ""


@adapter.property_method("image_list")
async def _(event: GroupMessage):
    if event.attachments:
        return [url for attachment in event.attachments if (url := attachment.url)]
    return []


@adapter.property_method("permission")
async def _(event: GroupMessage):
    user_id = event.author.member_openid
    if user_id in superusers:
        return 3
    return 0


# @adapter.property_method("at")
# async def _(event: GroupMessage) -> list[str]:
#     return []


# @adapter.property_method("group_member_list")
# async def _(client: Client, event: GroupMessage) -> None | list[dict]:
#     return None


__adapter__ = adapter
