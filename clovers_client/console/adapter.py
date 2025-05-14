from clovers import Adapter, Result
from collections.abc import AsyncGenerator
from io import BytesIO
from PIL import Image
from .config import Event, __config__

Bot_Nickname = __config__.Bot_Nickname


adapter = Adapter("CONSOLE")


@adapter.send_method("text")
async def send_text(message: str):
    print(f"[TEXT]{"\n" if "\n" in message else " "}{message}")


@adapter.send_method("image")
async def send_image(message: BytesIO | bytes):
    print("[IMAGE]")
    Image.open(BytesIO(message) if isinstance(message, bytes) else message).show()


@adapter.send_method("list")
async def send_list(message: list[Result]):
    for item in message:
        match item.send_method:
            case "text":
                await send_text(item.data)
            case "image":
                await send_image(item.data)
            case "list":
                await send_list(item.data)
            case _:
                print(f"Unknown send_method: {item.send_method}")


@adapter.send_method("segmented")
async def send_segmented(message: AsyncGenerator[Result]):
    async for item in message:
        match item.send_method:
            case "text":
                await send_text(item.data)
            case "image":
                await send_image(item.data)
            case "list":
                await send_list(item.data)
            case _:
                print(f"Unknown send_method: {item.send_method}")


@adapter.property_method("Bot_Nickname")
async def _():
    return Bot_Nickname


@adapter.property_method("user_id")
async def _(event: Event):
    return event.user.user_id


@adapter.property_method("group_id")
async def _(event: Event):
    if event.is_private:
        return
    else:
        return event.user.group_id


@adapter.property_method("nickname")
async def _(event: Event):
    return event.user.nickname


@adapter.property_method("avatar")
async def _(event: Event):
    return event.user.avatar


@adapter.property_method("group_avatar")
async def _(event: Event):
    return event.user.group_avatar


@adapter.property_method("permission")
async def _(event: Event):
    return event.user.permission


@adapter.property_method("to_me")
async def _(event: Event):
    return event.to_me


@adapter.property_method("at")
async def _(event: Event):
    return event.at


@adapter.property_method("image_list")
async def _(event: Event):
    return event.image_list


__adapter__ = adapter
