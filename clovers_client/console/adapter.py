import json
from pathlib import Path
from io import BytesIO
from clovers import Adapter
from clovers.logger import logger
from clovers_client.result import FileLike, ListMessage, SegmentedMessage
from .utils import upload, image_url
from .typing import MessageEvent, ConsoleMessage, ChatMessage, SendMethod


__adapter__ = adapter = Adapter()


@adapter.send_method("console")
async def send_console(message: list[str], send: SendMethod):
    data: ConsoleMessage = {"type": "system", "data": message}
    await send(data)


@adapter.send_method("at")
async def send_at(message: str, recv: MessageEvent, send: SendMethod):
    data: ChatMessage = {
        "type": "user",
        "text": "",
        "images": [],
        "at": [message],
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@adapter.send_method("text")
async def send_text(message: str, recv: MessageEvent, send: SendMethod):
    data: ChatMessage = {
        "type": "user",
        "text": message,
        "images": [],
        "at": [],
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


def file2bytes(image: FileLike):
    match image:
        case Path():
            return image.read_bytes()
        case BytesIO():
            return image.getvalue()
        case bytes():
            return image
        case _:
            raise TypeError(f"Unsupported type: {type(image)}")


@adapter.send_method("image")
async def send_image(message: FileLike, recv: MessageEvent, send: SendMethod, load_dir: Path):
    data: ChatMessage = {
        "type": "user",
        "at": [],
        "text": "",
        "images": [message if isinstance(message, str) else upload(load_dir, file2bytes(message))],
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@adapter.send_method("list")
async def send_list(message: ListMessage, recv: MessageEvent, send: SendMethod, load_dir: Path):
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
                image = result.data
                images.append(image if isinstance(image, str) else upload(load_dir, file2bytes(image)))
    data: ChatMessage = {
        "type": "user",
        "text": "\n".join(text),
        "images": images,
        "at": at,
        "senderId": recv["bot_nickname"],
        "senderName": recv["bot_nickname"],
        "avatar": recv["bot_avatar"],
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@adapter.send_method("segmented")
async def send_segmented(message: SegmentedMessage, recv: MessageEvent, send: SendMethod, load_dir: Path):
    async for result in message:
        match result.key:
            case "at":
                await send_at(result.data, recv, send)
            case "text":
                await send_text(result.data, recv, send)
            case "image":
                await send_image(result.data, recv, send, load_dir)
            case "list":
                await send_list(result.data, recv, send, load_dir)
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
    return recv["to_me"] or (recv["bot_nickname"] in recv["at"])


@adapter.property_method("at")
async def _(recv: MessageEvent) -> list[str]:
    return recv["at"]


@adapter.property_method("image_list")
async def _(recv: MessageEvent, load_dir: Path) -> list[str]:
    return [x for url in recv["images"] if (x := image_url(load_dir, url))]
