import json
from pathlib import Path
from io import BytesIO
from base64 import b64encode
from clovers import Adapter
from clovers.logger import logger
from clovers_client.result import FileLike, ListMessage, SegmentedMessage
from .typing import MessageEvent, ConsoleMessage, ChatMessage, SendFunction


__adapter__ = adapter = Adapter()


@adapter.send_method("console")
async def send_console(message: list[str], send: SendFunction):
    data: ConsoleMessage = {"type": "system", "data": message}
    await send(json.dumps(data, separators=(",", ":")))


@adapter.send_method("at")
async def send_at(message: str, recv: MessageEvent, send: SendFunction):
    data: ChatMessage = {
        "type": "user",
        "at": [message],
        "text": "",
        "images": [],
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(json.dumps(data, separators=(",", ":")))


@adapter.send_method("text")
async def send_text(message: str, recv: MessageEvent, send: SendFunction):
    data: ChatMessage = {
        "type": "user",
        "at": [],
        "text": message,
        "images": [],
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(json.dumps(data, separators=(",", ":")))


def image2url(image: FileLike) -> str:
    match image:
        case str():
            return image
        case Path():
            return f"data:image/png;base64,{b64encode(image.read_bytes()).decode()}"
        case BytesIO():
            return f"data:image/png;base64,{b64encode(image.getvalue()).decode()}"
        case bytes():
            return f"data:image/png;base64,{b64encode(image).decode()}"
        case _:
            raise TypeError(f"Unsupported type: {type(image)}")


@adapter.send_method("image")
async def send_image(message: FileLike, recv: MessageEvent, send: SendFunction):
    data: ChatMessage = {
        "type": "user",
        "at": [],
        "text": "",
        "images": [image2url(message)],
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(json.dumps(data, separators=(",", ":")))


@adapter.send_method("list")
async def send_list(message: ListMessage, recv: MessageEvent, send: SendFunction):
    at: list[str] = []
    text: list[str] = []
    images: list[str] = []
    for result in message:
        match result.key:
            case "at":
                at.append(result.data)
            case "text":
                text.append(result.data)
            case "image":
                images.append(image2url(result.data))
    data: ChatMessage = {
        "type": "user",
        "at": at,
        "text": "\n".join(text),
        "images": images,
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(json.dumps(data, separators=(",", ":")))


@adapter.send_method("segmented")
async def send_segmented(message: SegmentedMessage, recv: MessageEvent, send: SendFunction):
    async for result in message:
        match result.key:
            case "at":
                await send_at(result.data, recv, send)
            case "text":
                await send_text(result.data, recv, send)
            case "image":
                await send_image(result.data, recv, send)
            case "list":
                await send_list(result.data, recv, send)
            case "console":
                await send_console(result.data, recv, send)
            case _:
                logger.warning(f"Unknown send_method: {result.key}")


@adapter.property_method("Bot_Nickname")
async def _(recv: MessageEvent) -> str:
    return recv["bot_nickname"]


@adapter.property_method("user_id")
async def _(recv: MessageEvent) -> str:
    return recv["senderId"]


@adapter.property_method("group_id")
async def _(recv: MessageEvent) -> str | None:
    return None if recv["groupId"] == "private" else recv["groupId"]


@adapter.property_method("nickname")
async def _(recv: MessageEvent) -> str:
    return recv["senderName"]


@adapter.property_method("avatar")
async def _(recv: MessageEvent) -> str:
    return recv["avatar"]


@adapter.property_method("group_avatar")
async def _(recv: MessageEvent) -> str:
    return recv["groupAvatar"]


@adapter.property_method("permission")
async def _(recv: MessageEvent) -> int:
    match recv["permission"]:
        case "SuperUser":
            return 3 if recv["ip"] and recv["ip"].startswith("127.") else 2
        case "Owner":
            return 2
        case "Admin":
            return 1
        case _:
            return 0


@adapter.property_method("to_me")
async def _(recv: MessageEvent) -> bool:
    return recv["to_me"] or recv["bot_nickname"] in recv["at"]


@adapter.property_method("at")
async def _(recv: ChatMessage) -> list[str]:
    return recv["at"]


@adapter.property_method("image_list")
async def _(recv: ChatMessage) -> list[str]:
    return recv["images"]
