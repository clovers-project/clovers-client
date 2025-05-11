import httpx
from pathlib import Path
from collections.abc import AsyncGenerator
from clovers import Result
from typing import TypedDict, Protocol
from io import BytesIO


type ListMessage = list[Result]
type SegmentedMessage = AsyncGenerator[Result, None]
type FileLike = str | bytes | BytesIO | Path


class GroupMessage(TypedDict):
    group_id: str
    data: Result


class PrivateMessage(TypedDict):
    user_id: str
    data: Result


class Post(Protocol):
    async def __call__(self, endpoint: str, **kwargs) -> httpx.Response: ...
