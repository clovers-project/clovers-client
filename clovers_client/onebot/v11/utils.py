from typing import TypedDict, Literal
from collections.abc import Callable
from clovers_client.result import FileLike, SequenceMessage, SegmentedMessage, SingleResult, SequenceResult, OverallResult, SegmentedResult
from clovers_client.event import FlatContextUnit
from clovers_client.utils import format_filename
from .typing import MessageEvent, Message, Node, OneBotV11API


def list2message(message: SequenceMessage, format_file: Callable[[FileLike], str]) -> Message:
    msg = []
    for seg in message:
        match seg.key:
            case "text":
                msg.append({"type": "text", "data": {"text": seg.data}})
            case "image":
                msg.append({"type": "image", "data": {"file": format_file(seg.data)}})
            case "at":
                msg.append({"type": "at", "data": {"qq": seg.data}})
                msg.append({"type": "text", "data": {"text": " "}})
    return msg


def to_message(result: OverallResult, format_file: Callable[[FileLike], str]) -> Message | None:
    match result.key:
        case "at":
            return [{"type": "at", "data": {"qq": result.data}}]
        case "text":
            return [{"type": "text", "data": {"text": result.data}}]
        case "image":
            return [{"type": "image", "data": {"file": format_file(result.data)}}]
        case "list":
            return list2message(result.data, format_file)
        case "voice":
            return [{"type": "record", "data": {"file": format_file(result.data)}}]
        case "video":
            return [{"type": "video", "data": {"file": format_file(result.data)}}]


class Target(TypedDict):
    to: Literal["group", "private"]
    id: int


async def send_segmented(result: SegmentedMessage, format_file: Callable[[FileLike], str], call: OneBotV11API, target: Target):
    async for seg in result:
        if seg.key == "file":
            await upload_file(format_file(seg.data), format_filename(seg.data), call, target)
        elif msg := to_message(seg, format_file):
            await send_message(msg, call, target)


async def send_result(result: OverallResult | SegmentedResult, format_file: Callable[[FileLike], str], call: OneBotV11API, target: Target):
    match result.key:
        case "segmented":
            await send_segmented(result.data, format_file, call, target)
        case "file":
            await upload_file(format_file(result.data), format_filename(result.data), call, target)
        case _:
            if msg := to_message(result, format_file):
                await send_message(msg, call, target)


def resultlist2nodelist(
    self_name: str, self_id: int, message: list[SingleResult | SequenceResult], format_file: Callable[[FileLike], str]
) -> list[Node]:
    messages = []
    for result in message:
        if msg := to_message(result, format_file):
            messages.append({"type": "node", "data": {"name": self_name, "uin": self_id, "content": msg}})
    return messages


async def build_flat_context(call: OneBotV11API, msg_id: str) -> list[FlatContextUnit] | None:
    messages = (await call("get_forward_msg", {"message_id": msg_id}, True))["messages"]
    if not messages:
        return
    flat_context: list[FlatContextUnit] = []
    for node in messages:
        if not (content := node.get("content")):
            continue
        if content[0]["type"] == "forward":
            inner_context = await build_flat_context(call, content[0]["data"]["id"])
            if inner_context:
                flat_context.extend(inner_context)
            continue
        sender = node.get("sender")
        if not sender:
            user_id = "unknown"
            nickname = "unknown"
        else:
            user_id = str(sender.get("user_id", "unknown"))
            if "card" in sender and sender["card"]:
                nickname = sender["card"]
            else:
                nickname = sender.get("nickname", "unknown")
        text = []
        images = []
        for x in content:
            if x["type"] == "text":
                text.append(x["data"]["text"])
            elif x["type"] == "image":
                images.append(x["data"]["url"])
        flat_context.append({"nickname": nickname, "user_id": user_id, "text": "".join(text), "images": images})
    return flat_context


async def upload_file(file: str, name: str, call: OneBotV11API, target: Target):
    match target["to"]:
        case "group":
            await call("upload_group_file", {"group_id": target["id"], "file": file, "name": name})
        case "private":
            await call("upload_private_file", {"user_id": target["id"], "file": file, "name": name})


async def send_message(message: Message, call: OneBotV11API, target: Target):
    match target["to"]:
        case "group":
            await call("send_group_msg", {"group_id": target["id"], "message": message})
        case "private":
            await call("send_private_msg", {"user_id": target["id"], "message": message})


def to_target(recv: MessageEvent) -> Target:
    match recv["message_type"]:
        case "group":
            return {"to": "group", "id": recv["group_id"]}
        case "private":
            return {"to": "private", "id": recv["user_id"]}
