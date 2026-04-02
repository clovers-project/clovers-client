from typing import TypedDict, Protocol, Literal
from collections.abc import AsyncGenerator
from pathlib import Path
from io import BytesIO

type FileLike = str | bytes | BytesIO | Path

type JsonBaseType = str | int | float | bool | None
type JsonArray = list[JsonBaseType]
type JsonObject = dict[str, JsonBaseType | JsonArray]
type JsonType = JsonBaseType | JsonArray | JsonObject

type SingleResult = AtResult | TextResult | ImageResult
type ListMessage = list[SingleResult]
type OverallResult = SingleResult | ConsoleResult | ListResult | FileResult | VoiceResult | VideoResult
type SegmentedMessage = AsyncGenerator[OverallResult, None]
type Result = SingleResult | ListResult | SegmentedResult


class ConsoleResult(Protocol):
    key: Literal["console"]
    data: JsonType


class AtResult(Protocol):
    key: Literal["at"]
    data: str


class TextResult(Protocol):
    key: Literal["text"]
    data: str


class ImageResult(Protocol):
    key: Literal["image"]
    data: FileLike


class ListResult(Protocol):
    key: Literal["list"]
    data: ListMessage


class VoiceResult(Protocol):
    key: Literal["voice"]
    data: FileLike


class VideoResult(Protocol):
    key: Literal["video"]
    data: FileLike


class FileResult(Protocol):
    key: Literal["file"]
    data: FileLike


class SegmentedResult(Protocol):
    key: Literal["segmented"]
    data: SegmentedMessage


class GroupMessage(TypedDict):
    group_id: str
    data: Result


class GroupResult(TypedDict):
    key: Literal["group_message"]
    data: Result


class PrivateMessage(TypedDict):
    user_id: str
    data: Result


class PrivateResult(TypedDict):
    key: Literal["private_message"]
    data: Result


__all__ = ["SingleResult", "OverallResult", "SegmentedResult", "Result", "GroupResult", "PrivateResult"]
