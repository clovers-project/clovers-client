from pathlib import Path
from io import BytesIO
from base64 import b64encode
from clovers import Adapter
from .typing import Post, FileLike, ListMessage, SegmentedMessage, GroupMessage, PrivateMessage
from .config import __config__

Bot_Nickname = __config__.Bot_Nickname
superusers = __config__.superusers


def f2s(file: FileLike) -> str:
    if isinstance(file, str):
        return file
    elif isinstance(file, Path):
        return file.resolve().as_uri()
    elif isinstance(file, BytesIO):
        file = file.getvalue()
    return f"base64://{b64encode(file).decode()}"


adapter = Adapter("OneBot V11")


def list2message(message: ListMessage):
    msg = []
    for seg in message:
        match seg.key:
            case "text":
                msg.append({"type": "text", "data": {"text": seg.data}})
            case "image":
                msg.append({"type": "image", "data": {"file": f2s(seg.data)}})
            case "at":
                msg.append({"type": "at", "data": {"qq": int(seg.data)}})
            case "face":
                msg.append({"type": "face", "data": {"id": seg.data}})
    return msg


def build_message(recv: dict, message):
    match recv["message_type"]:
        case "group":
            return {"message_type": "group", "group_id": recv["group_id"], "message": message}
        case "private":
            return {"message_type": "private", "user_id": recv["user_id"], "message": message}


@adapter.send_method("text")
async def _(message: str, /, post: Post, recv: dict):
    await post("send_msg", json=build_message(recv, [{"type": "text", "data": {"text": message}}]))


@adapter.send_method("image")
async def _(message: FileLike, /, post: Post, recv: dict):
    await post("send_msg", json=build_message(recv, [{"type": "image", "data": {"file": f2s(message)}}]))


@adapter.send_method("voice")
async def _(message: FileLike, /, post: Post, recv: dict):
    await post("send_msg", json=build_message(recv, [{"type": "record", "data": {"file": f2s(message)}}]))


@adapter.send_method("list")
async def _(message: ListMessage, post: Post, recv: dict):
    await post("send_msg", json=build_message(recv, list2message(message)))


@adapter.send_method("segmented")
async def _(message: SegmentedMessage, /, post: Post, recv: dict):
    match recv["message_type"]:
        case "group":
            data = {"message_type": "group", "group_id": recv["group_id"]}
        case "private":
            data = {"message_type": "private", "user_id": recv["user_id"]}
        case _:
            raise ValueError("unknown message type")
    async for seg in message:
        if not (msg := list2message([seg])):
            continue
        data["message"] = msg
        await post("send_msg", json=data)


@adapter.send_method("group_message")
async def _(message: GroupMessage, /, post: Post):
    result = message["data"]
    data: dict = {"group_id": int(message["group_id"])}
    if result.key == "segmented":
        async for seg in result.data:
            if not (msg := list2message([seg])):
                continue
            data["message"] = msg
            await post("send_group_msg", json=data)
    elif msg := list2message([result]):
        data["message"] = msg
        await post("send_group_msg", json=data)


@adapter.send_method("private_message")
async def _(message: PrivateMessage, post: Post, recv: dict):
    result = message["data"]
    data: dict = {"user_id": int(message["user_id"])}
    if group_id := recv.get("group_id"):
        data["group_id"] = group_id
    if result.key == "segmented":
        async for seg in result.data:
            if not (msg := list2message([seg])):
                continue
            data["message"] = msg
            await post("send_private_msg", json=data)
    elif msg := list2message([result]):
        data["message"] = msg
        await post("send_private_msg", json=data)


@adapter.property_method("Bot_Nickname")
async def _() -> str:
    return Bot_Nickname


@adapter.property_method("user_id")
async def _(recv: dict) -> str:
    return str(recv["user_id"])


@adapter.property_method("group_id")
async def _(recv: dict) -> str | None:
    if "group_id" in recv:
        return str(recv["group_id"])


@adapter.property_method("to_me")
async def _(recv: dict) -> bool:
    if "to_me" in recv:
        return True
    self_id = recv["self_id"]
    return any(seg["type"] == "at" and seg["data"]["qq"] == self_id for seg in recv["message"])


@adapter.property_method("nickname")
async def _(recv: dict) -> str:
    return recv["sender"]["card"] or recv["sender"]["nickname"]


@adapter.property_method("avatar")
async def _(recv: dict) -> str:
    return f"https://q1.qlogo.cn/g?b=qq&nk={recv["user_id"]}&s=640"


@adapter.property_method("group_avatar")
async def _(recv: dict) -> str | None:
    if "group_id" not in recv:
        return
    group_id = recv["group_id"]
    return f"https://p.qlogo.cn/gh/{group_id}/{group_id}/640"


@adapter.property_method("image_list")
async def _(post: Post, recv: dict) -> list[str]:
    reply_id = None
    url = []
    for msg in recv["message"]:
        if msg["type"] == "image":
            url.append(msg["data"]["url"])
        elif msg["type"] == "reply":
            reply_id = msg["data"]["id"]
    if reply_id is not None:
        reply = await post("get_msg", data={"message_id": reply_id})
        url.extend(msg["data"]["url"] for msg in reply["data"]["message"] if msg["type"] == "image")
    return url


@adapter.property_method("permission")
async def _(recv: dict) -> int:
    if str(recv["user_id"]) in superusers:
        return 3
    if role := recv["sender"].get("role"):
        if role == "owner":
            return 2
        elif role == "admin":
            return 1
    return 0


@adapter.property_method("at")
async def _(recv: dict) -> list[str]:
    return [str(seg["data"]["qq"]) for seg in recv["message"] if seg["type"] == "at"]


@adapter.call_method("group_member_list")
async def _(group_id: str, /, post: Post):
    resp = await post("get_group_member_list", data={"group_id": int(group_id)})
    info_list = resp["data"]
    for user_info in info_list:
        user_id = str(user_info["user_id"])
        user_info["group_id"] = str(user_info["group_id"])
        user_info["user_id"] = user_id
        user_info["avatar"] = f"https://q1.qlogo.cn/g?b=qq&nk={user_id}&s=640"
    return info_list


@adapter.call_method("group_member_info")
async def _(group_id: str, user_id: str, /, post: Post):
    resp = await post("get_group_member_info", data={"group_id": int(group_id), "user_id": int(user_id)})
    user_info = resp["data"]
    member_user_id = str(user_info["user_id"])
    user_info["group_id"] = str(user_info["group_id"])
    user_info["user_id"] = member_user_id
    user_info["avatar"] = f"https://q1.qlogo.cn/g?b=qq&nk={member_user_id}&s=640"
    return user_info


__adapter__ = adapter
