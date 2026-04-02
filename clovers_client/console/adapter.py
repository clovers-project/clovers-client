from pathlib import Path
from io import BytesIO
from functools import partial
from fastapi import WebSocket
from clovers import Adapter
from clovers.logger import logger
from clovers_client.console import Client
from clovers_client.result import FileLike, ListMessage, SegmentedMessage, GroupMessage, PrivateMessage
from .utils import md5, upload, image_url
from .typing import MessageEvent, ConsoleMessage, ChatMessage, SendMethod


__adapter__ = adapter = Adapter()


@adapter.send_method("console")
async def send_console(message: list[str], send: SendMethod):
    data: ConsoleMessage = {"type": "system", "data": message}
    await send(data)


@adapter.send_method("at")
async def send_at(message: str, recv: MessageEvent, send: SendMethod, client: Client):
    data: ChatMessage = {
        "type": "user",
        "text": "",
        "images": [],
        "at": [message],
        "senderId": client.BOT_NICKNAME,
        "senderName": client.BOT_NICKNAME,
        "avatar": client.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@adapter.send_method("text")
async def send_text(message: str, recv: MessageEvent, send: SendMethod, client: Client):
    data: ChatMessage = {
        "type": "user",
        "text": message,
        "images": [],
        "at": [],
        "senderId": client.BOT_NICKNAME,
        "senderName": client.BOT_NICKNAME,
        "avatar": client.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


def file2bytes(file: FileLike):
    match file:
        case Path():
            return file.read_bytes()
        case BytesIO():
            return file.getvalue()
        case bytes():
            return file
        case _:
            raise TypeError(f"Unsupported type: {type(file)}")


@adapter.send_method("image")
async def send_image(message: FileLike, recv: MessageEvent, send: SendMethod, client: Client):
    data: ChatMessage = {
        "type": "user",
        "at": [],
        "text": "",
        "images": [message if isinstance(message, str) else upload(client.load_dir, file2bytes(message))],
        "senderId": client.BOT_NICKNAME,
        "senderName": client.BOT_NICKNAME,
        "avatar": client.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@adapter.send_method("list")
async def send_list(message: ListMessage, recv: MessageEvent, send: SendMethod, client: Client):
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
                images.append(image if isinstance(image, str) else upload(client.load_dir, file2bytes(image)))
    data: ChatMessage = {
        "type": "user",
        "text": "\n".join(text),
        "images": images,
        "at": at,
        "senderId": client.BOT_NICKNAME,
        "senderName": client.BOT_NICKNAME,
        "avatar": client.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@adapter.send_method("file")
async def send_file(message: FileLike, recv: MessageEvent, send: SendMethod, client: Client):
    data: ChatMessage = {
        "type": "user",
        "text": "",
        "images": [],
        "at": [],
        "senderId": client.BOT_NICKNAME,
        "senderName": client.BOT_NICKNAME,
        "avatar": client.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    if isinstance(message, str):
        if message.startswith("http"):
            data["text"] = f"[下载文件]({message})"
            return send(data)
        else:
            file = Path(message)
    elif isinstance(message, Path):
        file = message
    else:
        raise TypeError("file message must be str or Path")
    if not file.exists():
        raise FileNotFoundError(file)
    folder = client.load_dir / "file"
    folder.mkdir(parents=True, exist_ok=True)
    file_data = file.read_bytes()
    file_name = f"{md5(file_data)}{file.suffix}"
    file_path = folder / file_name
    file_path.write_bytes(file_data)
    data["text"] = f"[下载文件](/download/file/{file_name})"
    await send(data)


@adapter.send_method("segmented")
async def send_segmented(message: SegmentedMessage, recv: MessageEvent, send: SendMethod, client: Client):
    async for result in message:
        match result.key:
            case "at":
                await send_at(result.data, recv, send)
            case "text":
                await send_text(result.data, recv, send)
            case "image":
                await send_image(result.data, recv, send, client)
            case "list":
                await send_list(result.data, recv, send, client)
            case "file":
                await send_file(result.data, recv, send, client)
            case "console":
                await send_console(result.data, recv, send)
            case _:
                logger.warning(f"Unsupported send_method: {result.key}")


@adapter.send_method("group_message")
async def _(message: GroupMessage, recv: MessageEvent, client: Client):
    result = message["data"]
    redirect: MessageEvent = {
        "groupId": message["group_id"],
        "groupName": "",
        "groupAvatar": "",
    }  # type: ignore
    if result.key == "segmented":
        await send_segmented(result.data, redirect, client.broadcast, client)
    elif result.key == "list":
        await send_list(result.data, redirect, client.broadcast, client)
    else:
        await send_list([result.data], redirect, client.broadcast, client)


@adapter.send_method("private_message")
async def _(message: PrivateMessage, recv: MessageEvent, ws: WebSocket, client: Client):
    result = message["data"]
    senderId = recv["senderId"]
    if senderId != message["user_id"]:
        raise ValueError("私聊消息的目标只能是触发事件发送者自身")
    redirect: MessageEvent = {
        "groupId": "private",
        "groupName": client.BOT_NICKNAME,
        "groupAvatar": client.BOT_AVATAR_URL,
    }  # type: ignore
    unicast = partial(client.unicast, ws)
    if result.key == "segmented":
        await send_segmented(result.data, redirect, unicast, client)
    elif result.key == "list":
        await send_list(result.data, redirect, unicast, client)
    else:
        await send_list([result.data], redirect, unicast, client)


@adapter.property_method("Bot_Nickname")
async def _(client: Client) -> str:
    return client.BOT_NICKNAME


@adapter.property_method("to_me")
async def _(recv: MessageEvent, client: Client) -> bool:
    return recv["to_me"] or (client.BOT_NICKNAME in recv["at"])


@adapter.property_method("at")
async def _(recv: MessageEvent) -> list[str]:
    return recv["at"]


@adapter.property_method("image_list")
async def _(recv: MessageEvent, client: Client) -> list[str]:
    return [x for url in recv["images"] if (x := image_url(client.load_dir, url))]


@adapter.property_method("user_id")
async def _(recv: MessageEvent) -> str:
    return recv["senderId"]


@adapter.property_method("nickname")
async def _(recv: MessageEvent) -> str:
    return recv["senderName"]


@adapter.property_method("avatar")
async def _(recv: MessageEvent) -> str:
    return recv["avatar"]


@adapter.property_method("group_id")
async def _(recv: MessageEvent) -> str | None:
    return None if recv["groupId"] == "private" else recv["groupId"]


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
