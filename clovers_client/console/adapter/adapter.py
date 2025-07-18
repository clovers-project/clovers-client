import json
import websockets
from io import BytesIO
from base64 import b64encode
from clovers import Adapter, Result
from collections.abc import AsyncGenerator
from ..event import Event
from .config import Config

__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname

__adapter__ = adapter = Adapter("CONSOLE")


def build_message(key: str, message) -> str:
    return json.dumps({"nickname": BOT_NICKNAME, "type": key, "message": message})


@adapter.send_method("at")
async def send_at(message, ws_connect: websockets.ClientConnection):
    await ws_connect.send(build_message("at", message))


@adapter.send_method("text")
async def send_text(message: str, ws_connect: websockets.ClientConnection):
    await ws_connect.send(build_message("text", message))


@adapter.send_method("image")
async def send_image(message: BytesIO | bytes, ws_connect: websockets.ClientConnection):
    b64 = b64encode(message.getvalue() if isinstance(message, BytesIO) else message).decode()
    await ws_connect.send(build_message("image", b64))
    # await ws_connect.send(build_message("image", "[IMAGE]"))


@adapter.send_method("list")
async def send_list(message: list[Result], ws_connect):
    data = []
    for item in message:
        if item.key in ("text", "at"):
            data.append((item.key, item.data))
        elif item.key == "image":
            msg = item.data
            b64 = b64encode(msg.getvalue() if isinstance(msg, BytesIO) else msg).decode()
            data.append((item.key, b64))
            # data.append((item.key, "[IMAGE]"))
        else:
            print(f"Unknown send_method: {item.key}")
    await ws_connect.send(build_message("list", data))


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
            print(f"Unknown send_method: {result.key}")


@adapter.send_method("segmented")
async def send_segmented(message: AsyncGenerator[Result], ws_connect):
    async for item in message:
        await send_result(item, ws_connect)


@adapter.property_method("Bot_Nickname")
async def _() -> str:
    return BOT_NICKNAME


@adapter.property_method("user_id")
async def _(event: Event) -> str:
    return event.user.user_id


@adapter.property_method("group_id")
async def _(event: Event) -> str | None:
    if not event.is_private:
        return event.user.group_id


@adapter.property_method("nickname")
async def _(event: Event) -> str:
    return event.user.nickname


@adapter.property_method("avatar")
async def _(event: Event) -> str:
    return event.user.avatar


@adapter.property_method("group_avatar")
async def _(event: Event) -> str:
    return event.user.group_avatar


@adapter.property_method("permission")
async def _(event: Event) -> int:
    return event.user.permission


@adapter.property_method("to_me")
async def _(event: Event) -> bool:
    return event.to_me


@adapter.property_method("at")
async def _(event: Event) -> list[str]:
    return event.at


@adapter.property_method("image_list")
async def _(event: Event) -> list[str]:
    return event.image_list


__adapter__ = adapter
