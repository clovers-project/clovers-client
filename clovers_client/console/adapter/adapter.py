import json
import asyncio
import websockets
from io import BytesIO
from base64 import b64encode
from clovers import Adapter, Result
from clovers.logger import logger
from collections.abc import AsyncGenerator
from .config import Config
from ..typing import ChatMessage

__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname

__adapter__ = adapter = Adapter("CONSOLE")


def broadcast(message: ChatMessage, ws_connects: set[websockets.ServerConnection]):
    message.setdefault("type", "user")
    message.setdefault("senderId", f"bot")
    message.setdefault("senderName", BOT_NICKNAME)
    data = json.dumps(message, separators=(",", ":"))
    return map(lambda ws: ws.send(data), ws_connects)


@adapter.send_method("at")
async def send_at(message, ws_connects: set[websockets.ServerConnection]):
    """
    发送@消息
    """
    await asyncio.gather(*broadcast({"text": f"@{message}"}, ws_connects))


@adapter.send_method("text")
async def send_text(message: str, ws_connects: set[websockets.ServerConnection]):
    await asyncio.gather(*broadcast({"text": message}, ws_connects))


@adapter.send_method("image")
async def send_image(message: BytesIO | bytes, ws_connects: set[websockets.ServerConnection]):
    b64 = b64encode(message.getvalue() if isinstance(message, BytesIO) else message).decode()
    await asyncio.gather(*broadcast({"images": [f"data:image/png;base64,{b64}"]}, ws_connects))


@adapter.send_method("list")
async def send_list(message: list[Result], ws_connects: set[websockets.ServerConnection]):

    text = []
    images = []
    for item in message:
        if item.key == "text":
            text.append(item.data)
        elif item.key == "at":
            text.append(f"@{item.data}")
        elif item.key == "image":
            msg = item.data
            b64 = b64encode(msg.getvalue() if isinstance(msg, BytesIO) else msg).decode()
            images.append(f"data:image/png;base64,{b64}")
        else:
            logger.warning(f"Unknown send_method: {item.key}")
    chat_message: ChatMessage = {"text": " ".join(text), "images": images}
    await asyncio.gather(*broadcast(chat_message, ws_connects))


async def send_result(result: Result, ws_connect: websockets.ClientConnection):
    match result.key:
        case "at":
            await send_at(result.data, ws_connect)
        case "text":
            await send_text(result.data, ws_connect)
        case "image":
            await send_image(result.data, ws_connect)
        case "list":
            await send_list(result.data, ws_connect)
        case _:
            logger.warning(f"Unknown send_method: {result.key}")


@adapter.send_method("segmented")
async def send_segmented(message: AsyncGenerator[Result], ws_connect):
    async for item in message:
        await send_result(item, ws_connect)


@adapter.property_method("Bot_Nickname")
async def _() -> str:
    return BOT_NICKNAME


@adapter.property_method("user_id")
async def _(recv_data: dict) -> str:
    return recv_data["senderId"]


@adapter.property_method("group_id")
async def _(recv_data: dict) -> str | None:
    if not recv_data.get("is_private"):
        return recv_data.get("groupId")


@adapter.property_method("nickname")
async def _(recv_data: dict) -> str:
    return recv_data["senderName"]


@adapter.property_method("avatar")
async def _(recv_data: dict) -> str:
    return recv_data.get("avatar", "")


@adapter.property_method("group_avatar")
async def _(recv_data: dict) -> str:
    return recv_data.get("groupAvatar", "")


@adapter.property_method("permission")
async def _(recv_data: dict) -> int:
    if not (permission := recv_data.get("permission")):
        return 0
    match permission:
        case "SuperUser":
            return 3
        case "Owner":
            return 2
        case "Admin":
            return 1
    return 0


@adapter.property_method("to_me")
async def _(recv_data: dict) -> bool:
    return recv_data["to_me"]


@adapter.property_method("at")
async def _(recv_data: dict) -> list[str]:
    return recv_data["at"]


@adapter.property_method("image_list")
async def _(recv_data: dict) -> list[str]:
    return recv_data["images"]


__adapter__ = adapter
