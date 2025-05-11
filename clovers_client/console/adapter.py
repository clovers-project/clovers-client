from clovers import Adapter, Result
from collections.abc import AsyncGenerator
from io import BytesIO
from PIL import Image
from .data import User, Event

adapter = Adapter("console".upper())


async def send_text(message: str):
    print(message)


async def send_image(message: BytesIO | bytes):
    Image.open(BytesIO(message) if isinstance(message, bytes) else message).show()


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


adapter.send_method("text")(send_text)
adapter.send_method("image")(send_image)
adapter.send_method("list")(send_list)
adapter.send_method("segmented")(send_segmented)


@adapter.property_method("user_id")
async def _(user: User):
    return user.user_id


@adapter.property_method("group_id")
async def _(user: User, event: Event):
    if event.is_private:
        return
    else:
        return user.group_id


@adapter.property_method("nickname")
async def _(user: User):
    return user.nickname


@adapter.property_method("avatar")
async def _(user: User):
    return user.avatar


@adapter.property_method("group_avatar")
async def _(user: User):
    return user.group_avatar


@adapter.property_method("permission")
async def _(user: User):
    return user.permission


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
