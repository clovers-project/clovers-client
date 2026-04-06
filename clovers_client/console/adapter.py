from pathlib import Path
from io import BytesIO
from functools import partial
from fastapi import WebSocket
from clovers import Adapter
from clovers.logger import logger
from clovers_client.console import Client
from clovers_client.result import FileLike, SequenceMessage, SegmentedMessage, Result, GroupMessage, PrivateMessage
from .utils import md5, upload, image_url
from .typing import MessageEvent, ConsoleMessage, ChatMessage, SendMethod


ADAPTER = Adapter("CONSOLE")


@ADAPTER.setup
def setup(client: Client):
    global CLIENT
    CLIENT = client


@ADAPTER.send_method("console")
async def send_console(message: list[str], send: SendMethod):
    data: ConsoleMessage = {"type": "system", "data": message}
    await send(data)


@ADAPTER.send_method("at")
async def send_at(message: str, recv: MessageEvent, send: SendMethod):
    data: ChatMessage = {
        "type": "user",
        "text": "",
        "images": [],
        "at": [message],
        "senderId": CLIENT.BOT_NICKNAME,
        "senderName": CLIENT.BOT_NICKNAME,
        "avatar": CLIENT.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@ADAPTER.send_method("text")
async def send_text(message: str, recv: MessageEvent, send: SendMethod):
    data: ChatMessage = {
        "type": "user",
        "text": message,
        "images": [],
        "at": [],
        "senderId": CLIENT.BOT_NICKNAME,
        "senderName": CLIENT.BOT_NICKNAME,
        "avatar": CLIENT.BOT_AVATAR_URL,
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


@ADAPTER.send_method("image")
async def send_image(message: FileLike, recv: MessageEvent, send: SendMethod):
    data: ChatMessage = {
        "type": "user",
        "at": [],
        "text": "",
        "images": [message if isinstance(message, str) else upload(CLIENT.load_dir, file2bytes(message))],
        "senderId": CLIENT.BOT_NICKNAME,
        "senderName": CLIENT.BOT_NICKNAME,
        "avatar": CLIENT.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@ADAPTER.send_method("list")
async def send_list(message: SequenceMessage, recv: MessageEvent, send: SendMethod):
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
                images.append(image if isinstance(image := result.data, str) else upload(CLIENT.load_dir, file2bytes(image)))
    data: ChatMessage = {
        "type": "user",
        "text": "\n".join(text),
        "images": images,
        "at": at,
        "senderId": CLIENT.BOT_NICKNAME,
        "senderName": CLIENT.BOT_NICKNAME,
        "avatar": CLIENT.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    await send(data)


@ADAPTER.send_method("file")
async def send_file(message: FileLike, recv: MessageEvent, send: SendMethod):
    data: ChatMessage = {
        "type": "user",
        "text": "",
        "images": [],
        "at": [],
        "senderId": CLIENT.BOT_NICKNAME,
        "senderName": CLIENT.BOT_NICKNAME,
        "avatar": CLIENT.BOT_AVATAR_URL,
        "groupId": recv["groupId"],
        "groupName": recv["groupName"],
        "groupAvatar": recv["groupAvatar"],
        "permission": "Member",
    }
    if isinstance(message, str):
        if message.startswith("http"):
            data["text"] = f"[下载文件]({message})"
            await send(data)
            return
        else:
            file = Path(message)
    elif isinstance(message, Path):
        file = message
    else:
        raise TypeError("file message must be str or Path")
    if not file.exists():
        raise FileNotFoundError(file)
    folder = CLIENT.load_dir / "file"
    folder.mkdir(parents=True, exist_ok=True)
    file_data = file.read_bytes()
    file_name = f"{md5(file_data)}{file.suffix}"
    file_path = folder / file_name
    file_path.write_bytes(file_data)
    data["text"] = f"[下载文件](/download/file/{file_name})"
    await send(data)


async def send_result(result: Result, recv: MessageEvent, send: SendMethod):
    match result.key:
        case "at":
            await send_at(result.data, recv, send)
        case "text":
            await send_text(result.data, recv, send)
        case "image":
            await send_image(result.data, recv, send)
        case "list":
            await send_list(result.data, recv, send)
        case "segmented":
            await send_segmented(result.data, recv, send)
        case "file":
            await send_file(result.data, recv, send)
        case "console":
            await send_console(result.data, send)
        case _:
            logger.warning(f"Unsupported send_method: {result.key}")


@ADAPTER.send_method("segmented")
async def send_segmented(message: SegmentedMessage, recv: MessageEvent, send: SendMethod):
    async for result in message:
        await send_result(result, recv, send)


@ADAPTER.send_method("group_message")
async def _(message: GroupMessage):
    result = message["data"]
    redirect: MessageEvent = {
        "groupId": message["group_id"],
        "groupName": "",
        "groupAvatar": "",
    }  # type: ignore
    await send_result(result, redirect, CLIENT.broadcast)


@ADAPTER.send_method("private_message")
async def _(message: PrivateMessage, recv: MessageEvent, ws: WebSocket):
    result = message["data"]
    senderId = recv["senderId"]
    if senderId != message["user_id"]:
        raise ValueError("私聊消息的目标只能是触发事件发送者自身")
    redirect: MessageEvent = {
        "groupId": "private",
        "groupName": CLIENT.BOT_NICKNAME,
        "groupAvatar": CLIENT.BOT_AVATAR_URL,
    }  # type: ignore
    await send_result(result, redirect, partial(CLIENT.unicast, ws))


@ADAPTER.property_method("Bot_Nickname")
async def _(client: Client) -> str:
    return client.BOT_NICKNAME


@ADAPTER.property_method("to_me")
async def _(recv: MessageEvent) -> bool:
    return recv["to_me"] or (CLIENT.BOT_NICKNAME in recv["at"])


@ADAPTER.property_method("at")
async def _(recv: MessageEvent) -> list[str]:
    return recv["at"]


@ADAPTER.property_method("image_list")
async def _(recv: MessageEvent) -> list[str]:
    return [x for url in recv["images"] if (x := image_url(CLIENT.load_dir, url))]


@ADAPTER.property_method("user_id")
async def _(recv: MessageEvent) -> str:
    return recv["senderId"]


@ADAPTER.property_method("nickname")
async def _(recv: MessageEvent) -> str:
    return recv["senderName"]


@ADAPTER.property_method("avatar")
async def _(recv: MessageEvent) -> str:
    return recv["avatar"]


@ADAPTER.property_method("group_id")
async def _(recv: MessageEvent) -> str | None:
    return None if recv["groupId"] == "private" else recv["groupId"]


@ADAPTER.property_method("group_avatar")
async def _(recv: MessageEvent) -> str:
    return recv["groupAvatar"]


@ADAPTER.property_method("permission")
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
