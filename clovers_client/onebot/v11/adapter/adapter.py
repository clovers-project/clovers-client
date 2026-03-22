from clovers import Adapter
from .typing import Post, FileLike, ListMessage, OverallResult, SegmentedMessage, GroupMessage, PrivateMessage, MemberInfo
from ..typing import MessageEvent, Message
from .utils import f2s, result2seg, send_group_msg, send_private_msg, send_segmented, resultlist2nodelist, build_flat_context
from .config import BOT_NICKNAME, SUPERUSERS


__adapter__ = adapter = Adapter("OneBot V11")


@adapter.send_method("at")
async def _(message: str, /, post: Post, recv: MessageEvent):
    msg: Message = [{"type": "at", "data": {"qq": message}}]
    match recv["message_type"]:
        case "group":
            await post("send_group_msg", json={"group_id": recv["group_id"], "message": msg})
        case "private":
            await post("send_private_msg", json={"user_id": recv["user_id"], "message": msg})


@adapter.send_method("text")
async def _(message: str, /, post: Post, recv: MessageEvent):
    msg: Message = [{"type": "text", "data": {"text": message}}]
    match recv["message_type"]:
        case "group":
            await post("send_group_msg", json={"group_id": recv["group_id"], "message": msg})
        case "private":
            await post("send_private_msg", json={"user_id": recv["user_id"], "message": msg})


@adapter.send_method("image")
async def _(message: FileLike, /, post: Post, recv: MessageEvent):
    msg: Message = [{"type": "image", "data": {"file": f2s(message)}}]
    match recv["message_type"]:
        case "group":
            await post("send_group_msg", json={"group_id": recv["group_id"], "message": msg})
        case "private":
            await post("send_private_msg", json={"user_id": recv["user_id"], "message": msg})


@adapter.send_method("voice")
async def _(message: FileLike, /, post: Post, recv: MessageEvent):
    msg: Message = [{"type": "record", "data": {"file": f2s(message)}}]
    match recv["message_type"]:
        case "group":
            await post("send_group_msg", json={"group_id": recv["group_id"], "message": msg})
        case "private":
            await post("send_private_msg", json={"user_id": recv["user_id"], "message": msg})


@adapter.send_method("list")
async def _(message: ListMessage, post: Post, recv: MessageEvent):
    msg = [seg for single in message if (seg := result2seg(single))]
    match recv["message_type"]:
        case "group":
            await post("send_group_msg", json={"group_id": recv["group_id"], "message": msg})
        case "private":
            await post("send_private_msg", json={"user_id": recv["user_id"], "message": msg})


@adapter.send_method("segmented")
async def _(message: SegmentedMessage, /, post: Post, recv: MessageEvent):
    match recv["message_type"]:
        case "group":
            await send_segmented(lambda msg: send_group_msg(post, recv, msg), message)
        case "private":
            await send_segmented(lambda msg: send_private_msg(post, recv, msg), message)


@adapter.send_method("group_message")
async def _(message: GroupMessage, /, post: Post):
    result = message["data"]
    group_id = int(message["group_id"])
    if result.key == "segmented":
        await send_segmented(lambda msg: post("send_group_msg", json={"group_id": group_id, "message": msg}), result.data)
    elif result.key == "list":
        msg = [seg for single in result.data if (seg := result2seg(single))]
        if msg:
            await post("send_group_msg", json={"group_id": group_id, "message": msg})
    else:
        if seg := result2seg(result):
            await post("send_group_msg", json={"group_id": group_id, "message": [seg]})


@adapter.send_method("private_message")
async def _(message: PrivateMessage, /, post: Post, recv: MessageEvent):
    result = message["data"]
    user_id = int(message["user_id"])
    if result.key == "segmented":
        await send_segmented(lambda msg: post("send_private_msg", json={"user_id": user_id, "message": msg}), result.data)
    elif result.key == "list":
        msg = [seg for single in result.data if (seg := result2seg(single))]
        if msg:
            await post("send_private_msg", json={"user_id": user_id, "message": msg})
    else:
        if seg := result2seg(result):
            await post("send_private_msg", json={"user_id": user_id, "message": [seg]})


@adapter.send_method("merge_forward")
async def _(message: list[OverallResult], /, post: Post, recv: MessageEvent):
    messages = resultlist2nodelist(BOT_NICKNAME, recv["self_id"], message)
    match recv["message_type"]:
        case "group":
            await post("send_group_forward_msg", json={"group_id": recv["group_id"], "messages": messages})
        case "private":
            await post("send_private_forward_msg", json={"user_id": recv["user_id"], "messages": messages})


@adapter.property_method("Bot_Nickname")
async def _() -> str:
    return BOT_NICKNAME


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
    self_id = str(recv["self_id"])
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
async def _(post: Post, recv: MessageEvent) -> list[str]:
    reply_id = None
    url = []
    for msg in recv["message"]:
        if msg["type"] == "image":
            url.append(msg["data"]["url"])
        elif msg["type"] == "reply":
            reply_id = msg["data"]["id"]
    if reply_id is not None:
        reply = await post("get_msg", json={"message_id": reply_id})
        url.extend(msg["data"]["url"] for msg in reply.json()["data"]["message"] if msg["type"] == "image")
    return url


@adapter.property_method("flat_context")
async def _(post: Post, recv: MessageEvent):
    reply_id = next((msg["data"]["id"] for msg in recv["message"] if msg["type"] == "reply"), None)
    if not reply_id:
        return
    reply = await post("get_msg", json={"message_id": reply_id})
    seg = reply.json()["data"]["message"][0]
    if seg["type"] != "forward":
        return
    return await build_flat_context(post, seg["data"]["id"])


@adapter.property_method("permission")
async def _(recv: dict) -> int:
    if str(recv["user_id"]) in SUPERUSERS:
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


@adapter.call_method("group_member_info")
async def _(group_id: str, user_id: str, /, post: Post) -> MemberInfo:
    resp = await post("get_group_member_info", json={"group_id": int(group_id), "user_id": int(user_id)})
    user_info = resp.json()["data"]
    return {
        "group_id": group_id,
        "user_id": user_id,
        "avatar": f"https://q1.qlogo.cn/g?b=qq&nk={user_id}&s=640",
        "nickname": user_info["nickname"],
        "card": user_info["card"],
        "last_sent_time": user_info.get("last_sent_time", 0),
    }


@adapter.call_method("group_member_list")
async def _(group_id: str, /, post: Post) -> list[MemberInfo]:
    resp = await post("get_group_member_list", json={"group_id": int(group_id)})
    info_list: list[MemberInfo] = resp.json()["data"]  # type: ignore
    for user_info in info_list:
        user_id = str(user_info["user_id"])
        user_info["group_id"] = group_id
        user_info["user_id"] = user_id
        user_info["avatar"] = f"https://q1.qlogo.cn/g?b=qq&nk={user_id}&s=640"
    return info_list


__all__ = ["__adapter__"]
