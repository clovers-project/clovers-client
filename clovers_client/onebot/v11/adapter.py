from clovers import Adapter
from clovers.logger import logger
from clovers_client.result import FileLike, SequenceMessage, SegmentedMessage, GroupMessage, PrivateMessage, MergeForwardMessage
from clovers_client.event import MemberInfo, PermissionLiteral, FlatContextUnit
from clovers_client.utils import format_filename
from clovers_client.onebot.v11 import Client
from .typing import MessageEvent, OneBotV11API
from .utils import list2message, send_message, upload_file, send_segmented, to_target, send_result, resultlist2nodelist, build_flat_context

ADAPTER = Adapter("OneBot V11")


@ADAPTER.send_method("console")
async def send_console(message: list[str], /):
    title, groupId, msg = message
    logger.info(f"[CONSOLE][{groupId}][{title}]: {msg}")


@ADAPTER.send_method("at")
async def _(message: str, /, call: OneBotV11API, recv: MessageEvent) -> None:
    await send_message([{"type": "at", "data": {"qq": message}}], call, to_target(recv))


@ADAPTER.send_method("text")
async def _(message: str, /, call: OneBotV11API, recv: MessageEvent) -> None:
    await send_message([{"type": "text", "data": {"text": message}}], call, to_target(recv))


@ADAPTER.send_method("image")
async def _(message: FileLike, /, call: OneBotV11API, recv: MessageEvent, client: Client) -> None:
    await send_message([{"type": "image", "data": {"file": client.format_file(message)}}], call, to_target(recv))


@ADAPTER.send_method("list")
async def _(message: SequenceMessage, /, call: OneBotV11API, recv: MessageEvent, client: Client) -> None:
    await send_message(list2message(message, client.format_file), call, to_target(recv))


@ADAPTER.send_method("voice")
async def _(message: FileLike, /, call: OneBotV11API, recv: MessageEvent, client: Client) -> None:
    await send_message([{"type": "record", "data": {"file": client.format_file(message)}}], call, to_target(recv))


@ADAPTER.send_method("video")
async def _(message: FileLike, /, call: OneBotV11API, recv: MessageEvent, client: Client) -> None:
    await send_message([{"type": "video", "data": {"file": client.format_file(message)}}], call, to_target(recv))


@ADAPTER.send_method("file")
async def _(message: FileLike, /, call: OneBotV11API, recv: MessageEvent, client: Client):
    await upload_file(client.format_file(message), format_filename(message), call, to_target(recv))


@ADAPTER.send_method("segmented")
async def _(message: SegmentedMessage, /, call: OneBotV11API, recv: MessageEvent, client: Client):
    await send_segmented(message, client.format_file, call, to_target(recv))


@ADAPTER.send_method("group_message")
async def _(message: GroupMessage, /, call: OneBotV11API, client: Client):
    await send_result(message["data"], client.format_file, call, {"to": "group", "id": int(message["group_id"])})


@ADAPTER.send_method("private_message")
async def _(message: PrivateMessage, /, call: OneBotV11API, client: Client):
    await send_result(message["data"], client.format_file, call, {"to": "private", "id": int(message["user_id"])})


@ADAPTER.send_method("merge_forward")
async def _(message: MergeForwardMessage, /, call: OneBotV11API, recv: MessageEvent, client: Client):
    messages = resultlist2nodelist(client.BOT_NICKNAME, recv["self_id"], message, client.format_file)
    match recv["message_type"]:
        case "group":
            await call("send_group_forward_msg", {"group_id": recv["group_id"], "messages": messages})
        case "private":
            await call("send_private_forward_msg", {"user_id": recv["user_id"], "messages": messages})


@ADAPTER.property_method("bot_nickname")
async def _(client: Client) -> str:
    return client.BOT_NICKNAME


@ADAPTER.property_method("to_me")
async def _(recv: dict) -> bool:
    if "to_me" in recv:
        return True
    self_id = str(recv["self_id"])
    return any(seg["type"] == "at" and seg["data"]["qq"] == self_id for seg in recv["message"])


@ADAPTER.property_method("at")
async def _(recv: dict) -> list[str]:
    return [str(seg["data"]["qq"]) for seg in recv["message"] if seg["type"] == "at"]


@ADAPTER.property_method("image_list")
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


@ADAPTER.property_method("user_id")
async def _(recv: MessageEvent) -> str:
    return str(recv["user_id"])


@ADAPTER.property_method("nickname")
async def _(recv: MessageEvent) -> str:
    sender = recv["sender"]
    if "card" in sender:
        return sender["card"] or sender["nickname"] or "unknown"
    else:
        return sender["nickname"] or "unknown"


@ADAPTER.property_method("avatar")
async def _(recv: MessageEvent) -> str:
    return f"https://q1.qlogo.cn/g?b=qq&nk={recv["user_id"]}&s=640"


@ADAPTER.property_method("group_id")
async def _(recv: MessageEvent) -> str | None:
    if "group_id" in recv:
        return str(recv["group_id"])


@ADAPTER.property_method("group_avatar")
async def _(recv: MessageEvent) -> str | None:
    if "group_id" not in recv:
        return
    group_id = recv["group_id"]
    return f"https://p.qlogo.cn/gh/{group_id}/{group_id}/640"


@ADAPTER.property_method("permission")
async def _(recv: MessageEvent, client: Client) -> PermissionLiteral:
    if str(recv["user_id"]) in client.SUPERUSERS:
        return 3
    if role := recv["sender"].get("role"):
        if role == "owner":
            return 2
        elif role == "admin":
            return 1
    return 0


@ADAPTER.property_method("flat_context")
async def _(call: OneBotV11API, recv: MessageEvent) -> list[FlatContextUnit] | None:
    reply_id = next((msg["data"]["id"] for msg in recv["message"] if msg["type"] == "reply"), None)
    if not reply_id:
        return
    reply = await call("get_msg", {"message_id": reply_id}, True)
    seg = reply["message"][0]
    if seg["type"] != "forward":
        return
    return await build_flat_context(call, seg["data"]["id"])


@ADAPTER.call_method("group_member_info")
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


@ADAPTER.call_method("group_member_list")
async def _(group_id: str, /, call: OneBotV11API) -> list[MemberInfo]:
    info_list: list[MemberInfo] = await call("get_group_member_list", {"group_id": int(group_id)}, True)  # type: ignore
    for user_info in info_list:
        user_id = str(user_info["user_id"])
        user_info["group_id"] = group_id
        user_info["user_id"] = user_id
        user_info["avatar"] = f"https://q1.qlogo.cn/g?b=qq&nk={user_id}&s=640"
    return info_list


__all__ = ["ADAPTER"]
