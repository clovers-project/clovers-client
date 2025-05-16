from pathlib import Path
from io import BytesIO
from botpy.message import Message
from botpy import Client
from collections.abc import AsyncGenerator
from clovers import Adapter, Result
from .typing import ListMessage, SegmentedMessage, FileLike
from ..config import __config__

Bot_Nickname = __config__.Bot_Nickname
superusers = __config__.superusers

adapter = Adapter()


@adapter.send_method("at")
async def _(data: str, event: Message):
    await event.reply(content=f"<@{data}>")


def to_image(data: FileLike):
    kwargs = {}
    if isinstance(data, str):
        kwargs["image"] = data
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
async def _(data: FileLike, event: Message):
    await event.reply(**to_image(data))


# @adapter.send_method("voice")
# async def _(data: str, event: Message):
#     """发送音频消息"""


@adapter.send_method("list")
async def _(data: list[Result], event: Message):
    """发送图片文本混合信息"""
    print(data)
    content = ""
    image = None
    for seg in data:
        match seg.send_method:
            case "at":
                content += f"<@{seg.data}>"
            case "text":
                content += seg.data
            case "image":
                image = seg.data
    if not image:
        return await event.reply(content=content)
    return await event.reply(content=content, media={"file_type": 1, "url": image})


@adapter.send_method("segmented")
async def _(data: AsyncGenerator[Result, None]):
    """发送分段信息"""
    async for seg in data:
        await adapter.sends_lib[seg.send_method](seg.data)


# @adapter.property_method("send_group_message")
# async def _(data: Result, client: Client, event: Message) -> Callable[[str, Result], Coroutine]:
#     pass


@adapter.property_method("Bot_Nickname")
async def _():
    return Bot_Nickname


@adapter.property_method("user_id")
async def _(event: Message):
    return event.author.id


@adapter.property_method("group_id")
async def _(event: Message):
    return event.guild_id


@adapter.property_method("to_me")
async def _(to_me: bool):
    return to_me


@adapter.property_method("nickname")
async def _(event: Message) -> str:
    return event.author.username


@adapter.property_method("avatar")
async def _(event: Message) -> str:
    return event.author.avatar


@adapter.property_method("group_avatar")
async def _(client: Client, event: Message) -> str:
    guild_info = await client.api.get_guild(guild_id=event.guild_id)
    return guild_info["icon"]


@adapter.property_method("image_list")
async def _(event: Message):
    if event.attachments:
        return [url for attachment in event.attachments if (url := attachment.url)]
    return []


@adapter.property_method("permission")
async def _(client: Client, event: Message):
    user_id = event.author.id
    channel_id = event.channel_id
    if user_id in superusers:
        return 3
    data = await client.api.get_channel_user_permissions(channel_id=channel_id, user_id=user_id)
    match data["role_id"]:
        case "2" | "5":
            return 1
        case "4":
            return 2
    return 0


@adapter.property_method("at")
async def _(event: Message) -> list[str]:
    if event.mentions:
        return [mention.id for mention in event.mentions]
    return []


# @adapter.property_method("group_member_list")
# async def _(client: Client, event: Message) -> None | list[dict]:
#     return None

__adapter__ = adapter
