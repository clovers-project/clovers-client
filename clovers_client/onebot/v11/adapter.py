import os
import asyncio
from pathlib import Path
from io import BytesIO
from tempfile import NamedTemporaryFile
from clovers import Adapter
from clovers.logger import logger
from clovers_client.result import FileLike, SequenceMessage, SingleResult, SequenceResult, SegmentedMessage, GroupMessage, PrivateMessage
from clovers_client.event import MemberInfo
from .typing import MessageEvent, Message, OneBotV11API
from .utils import f2s, result2seg, send_group_msg, send_private_msg, send_segmented, resultlist2nodelist, build_flat_context

__adapter__ = adapter = Adapter("OneBot V11")


@adapter.send_method("console")
async def send_console(message: list[str], /):
    title, groupId, msg = message
    logger.info(f"[CONSOLE][{groupId}][{title}]: {msg}")


@adapter.send_method("at")
async def _(message: str, /, call: OneBotV11API, recv: MessageEvent):
    msg: Message = [{"type": "at", "data": {"qq": message}}]
    match recv["message_type"]:
        case "group":
            await call("send_group_msg", {"group_id": recv["group_id"], "message": msg})
        case "private":
            await call("send_private_msg", {"user_id": recv["user_id"], "message": msg})


@adapter.send_method("text")
async def _(message: str, /, call: OneBotV11API, recv: MessageEvent):
    msg: Message = [{"type": "text", "data": {"text": message}}]
    match recv["message_type"]:
        case "group":
            await call("send_group_msg", {"group_id": recv["group_id"], "message": msg})
        case "private":
            await call("send_private_msg", {"user_id": recv["user_id"], "message": msg})


@adapter.send_method("image")
async def _(message: FileLike, /, call: OneBotV11API, recv: MessageEvent):
    msg: Message = [{"type": "image", "data": {"file": f2s(message)}}]
    match recv["message_type"]:
        case "group":
            await call("send_group_msg", {"group_id": recv["group_id"], "message": msg})
        case "private":
            await call("send_private_msg", {"user_id": recv["user_id"], "message": msg})


@adapter.send_method("voice")
async def _(message: FileLike, /, call: OneBotV11API, recv: MessageEvent):
    msg: Message = [{"type": "record", "data": {"file": f2s(message)}}]
    match recv["message_type"]:
        case "group":
            await call("send_group_msg", {"group_id": recv["group_id"], "message": msg})
        case "private":
            await call("send_private_msg", {"user_id": recv["user_id"], "message": msg})


@adapter.send_method("list")
async def _(message: SequenceMessage, /, call: OneBotV11API, recv: MessageEvent):
    msg = [seg for single in message if (seg := result2seg(single))]
    match recv["message_type"]:
        case "group":
            await call("send_group_msg", {"group_id": recv["group_id"], "message": msg})
        case "private":
            await call("send_private_msg", {"user_id": recv["user_id"], "message": msg})


async def del_file_task(file: str, seconds: int = 30):
    await asyncio.sleep(seconds)
    os.unlink(file)


@adapter.send_method("file")
async def _(message: FileLike, /, call: OneBotV11API, recv: MessageEvent):
    match recv["message_type"]:
        case "group":
            upload_file = lambda url: call("upload_group_file", {"group_id": recv["group_id"], "file": url})
        case "private":
            upload_file = lambda url: call("upload_private_file", {"user_id": recv["user_id"], "file": url})
        case _:
            logger.error(f"unknown message_type: {message}")
            return
    match message:
        case str():
            await upload_file(message)
            return
        case Path():
            await upload_file(message.as_posix())
            return
        case bytes():
            with NamedTemporaryFile(suffix=".tmp", delete=False) as tmp:
                tmp.write(message)
                tmp.flush()
                file = tmp.name
        case BytesIO():
            with NamedTemporaryFile(suffix=".tmp", delete=False) as tmp:
                message.seek(0)
                while chunk := message.read(8192):
                    tmp.write(chunk)
                tmp.flush()
                file = tmp.name
        case _:
            logger.warning(f"unknown file message type: {type(message)}")
            return
    try:
        await upload_file(file)
    finally:
        asyncio.create_task(del_file_task(file))


@adapter.send_method("segmented")
async def _(message: SegmentedMessage, /, call: OneBotV11API, recv: MessageEvent):
    match recv["message_type"]:
        case "group":
            await send_segmented(lambda msg: send_group_msg(call, recv, msg), message)
        case "private":
            await send_segmented(lambda msg: send_private_msg(call, recv, msg), message)


@adapter.send_method("group_message")
async def _(message: GroupMessage, /, call: OneBotV11API):
    print(f"GroupMessage {message}")
    result = message["data"]
    group_id = int(message["group_id"])
    if result.key == "segmented":
        await send_segmented(lambda msg: call("send_group_msg", {"group_id": group_id, "message": msg}), result.data)
    elif result.key == "list":
        msg = [seg for single in result.data if (seg := result2seg(single))]
        if msg:
            await call("send_group_msg", {"group_id": group_id, "message": msg})
    else:
        if seg := result2seg(result):
            await call("send_group_msg", {"group_id": group_id, "message": [seg]})


@adapter.send_method("private_message")
async def _(message: PrivateMessage, /, call: OneBotV11API):
    result = message["data"]
    user_id = int(message["user_id"])
    if result.key == "segmented":
        await send_segmented(lambda msg: call("send_private_msg", {"user_id": user_id, "message": msg}), result.data)
    elif result.key == "list":
        msg = [seg for single in result.data if (seg := result2seg(single))]
        if msg:
            await call("send_private_msg", {"user_id": user_id, "message": msg})
    else:
        if seg := result2seg(result):
            await call("send_private_msg", {"user_id": user_id, "message": [seg]})


@adapter.send_method("merge_forward")
async def _(message: list[SingleResult | SequenceResult], /, call: OneBotV11API, recv: MessageEvent):
    messages = resultlist2nodelist(recv["BOT_NICKNAME"], recv["self_id"], message)
    match recv["message_type"]:
        case "group":
            await call("send_group_forward_msg", {"group_id": recv["group_id"], "messages": messages})
        case "private":
            await call("send_private_forward_msg", {"user_id": recv["user_id"], "messages": messages})


@adapter.property_method("Bot_Nickname")
async def _(recv: MessageEvent) -> str:
    return recv["BOT_NICKNAME"]


@adapter.property_method("to_me")
async def _(recv: dict) -> bool:
    if "to_me" in recv:
        return True
    self_id = str(recv["self_id"])
    return any(seg["type"] == "at" and seg["data"]["qq"] == self_id for seg in recv["message"])


@adapter.property_method("at")
async def _(recv: dict) -> list[str]:
    return [str(seg["data"]["qq"]) for seg in recv["message"] if seg["type"] == "at"]


@adapter.property_method("image_list")
async def _(call: OneBotV11API, recv: MessageEvent) -> list[str]:
    reply_id = None
    url = []
    for msg in recv["message"]:
        if msg["type"] == "image":
            url.append(msg["data"]["url"])
        elif msg["type"] == "reply":
            reply_id = msg["data"]["id"]
    if reply_id is not None:
        reply = await call("get_msg", {"message_id": reply_id}, True)
        url.extend(msg["data"]["url"] for msg in reply["message"] if msg["type"] == "image")
    return url


@adapter.property_method("user_id")
async def _(recv: MessageEvent) -> str:
    return str(recv["user_id"])


@adapter.property_method("nickname")
async def _(recv: dict) -> str:
    return recv["sender"]["card"] or recv["sender"]["nickname"]


@adapter.property_method("avatar")
async def _(recv: dict) -> str:
    return f"https://q1.qlogo.cn/g?b=qq&nk={recv["user_id"]}&s=640"


@adapter.property_method("group_id")
async def _(recv: dict) -> str | None:
    if "group_id" in recv:
        return str(recv["group_id"])


@adapter.property_method("group_avatar")
async def _(recv: dict) -> str | None:
    if "group_id" not in recv:
        return
    group_id = recv["group_id"]
    return f"https://p.qlogo.cn/gh/{group_id}/{group_id}/640"


@adapter.property_method("permission")
async def _(recv: dict) -> int:
    if str(recv["user_id"]) in recv["SUPERUSERS"]:
        return 3
    if role := recv["sender"].get("role"):
        if role == "owner":
            return 2
        elif role == "admin":
            return 1
    return 0


@adapter.property_method("flat_context")
async def _(call: OneBotV11API, recv: MessageEvent):
    reply_id = next((msg["data"]["id"] for msg in recv["message"] if msg["type"] == "reply"), None)
    if not reply_id:
        return
    reply = await call("get_msg", {"message_id": reply_id}, True)
    seg = reply["message"][0]
    if seg["type"] != "forward":
        return
    return await build_flat_context(call, seg["data"]["id"])


@adapter.call_method("group_member_info")
async def _(group_id: str, user_id: str, /, call: OneBotV11API) -> MemberInfo:
    user_info = await call("get_group_member_info", {"group_id": int(group_id), "user_id": int(user_id)}, True)
    return {
        "group_id": group_id,
        "user_id": user_id,
        "avatar": f"https://q1.qlogo.cn/g?b=qq&nk={user_id}&s=640",
        "nickname": user_info["nickname"],
        "card": user_info["card"],
        "last_sent_time": user_info.get("last_sent_time", 0),
    }


@adapter.call_method("group_member_list")
async def _(group_id: str, /, call: OneBotV11API) -> list[MemberInfo]:
    info_list: list[MemberInfo] = await call("get_group_member_list", {"group_id": int(group_id)}, True)  # type: ignore
    for user_info in info_list:
        user_id = str(user_info["user_id"])
        user_info["group_id"] = group_id
        user_info["user_id"] = user_id
        user_info["avatar"] = f"https://q1.qlogo.cn/g?b=qq&nk={user_id}&s=640"
    return info_list


__all__ = ["__adapter__"]
