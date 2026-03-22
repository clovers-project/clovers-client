from pathlib import Path
from io import BytesIO
from base64 import b64encode
from collections.abc import Callable, Coroutine
from typing import Any
from .typing import Post, FileLike, SegmentedMessage, SingleResult, OverallResult, FlatContextUnit
from ..typing import MessageEvent, GroupMessageEvent, Message, MessageSegmentSend, Node


def f2s(file: FileLike) -> str:
    if isinstance(file, str):
        return file
    elif isinstance(file, Path):
        return file.resolve().as_uri()
    elif isinstance(file, BytesIO):
        file = file.getvalue()
    return f"base64://{b64encode(file).decode()}"


def result2seg(result: SingleResult) -> MessageSegmentSend | None:
    match result.key:
        case "text":
            return {"type": "text", "data": {"text": result.data}}
        case "image":
            return {"type": "image", "data": {"file": f2s(result.data)}}
        case "at":
            return {"type": "at", "data": {"qq": result.data}}
        case "face":
            return {"type": "face", "data": {"id": result.data}}


async def send_group_msg(post: Post, recv: GroupMessageEvent, message: Message):
    await post("send_group_msg", json={"group_id": recv["group_id"], "message": message})


async def send_private_msg(post: Post, recv: MessageEvent, message: Message):
    await post("send_private_msg", json={"user_id": recv["user_id"], "message": message})


async def send_segmented(send: Callable[[Message], Coroutine[Any, Any, None]], message: SegmentedMessage):
    async for result in message:
        if result.key == "list":
            msg = [seg for single in result.data if (seg := result2seg(single))]
            if not msg:
                continue
        else:
            seg = result2seg(result)
            if not seg:
                continue
            msg = [seg]
        await send(msg)


def resultlist2nodelist(self_name: str, self_id: int, message: list[OverallResult]) -> list[Node]:
    messages = []
    for result in message:
        if result.key == "list":
            msg = [seg for single in result.data if (seg := result2seg(single))]
            if not msg:
                continue
        else:
            seg = result2seg(result)
            if not seg:
                continue
            msg = [seg]
        messages.append({"type": "node", "data": {"name": self_name, "uin": self_id, "content": msg}})
    return messages


async def build_flat_context(post: Post, msg_id: str) -> list[FlatContextUnit] | None:
    context = await post("get_forward_msg", json={"message_id": msg_id})
    messages = context["data"]["messages"]
    if not messages:
        return
    flat_context: list[FlatContextUnit] = []
    for node in messages:
        if not (content := node.get("content")):
            continue
        if content[0]["type"] == "forward":
            inner_context = await build_flat_context(post, content[0]["data"]["id"])
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
