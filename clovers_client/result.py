from pathlib import Path
from collections.abc import AsyncGenerator
from typing import TypedDict, Protocol, Literal
from io import BytesIO

type FileLike = str | bytes | BytesIO | Path
type JsonBaseType = str | int | float | bool | None
type JsonArray = list[JsonBaseType]
type JsonObject = dict[str, JsonBaseType | JsonArray]
type JsonType = JsonBaseType | JsonArray | JsonObject


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


class VoiceResult(Protocol):
    key: Literal["voice"]
    data: FileLike


class VideoResult(Protocol):
    key: Literal["video"]
    data: FileLike


type SingleResult = AtResult | TextResult | ImageResult | VoiceResult | VideoResult | ConsoleResult

type ListMessage = list[SingleResult]


class ListResult(Protocol):
    key: Literal["list"]
    data: ListMessage


class FileResult(Protocol):
    key: Literal["file"]
    data: FileLike


type OverallResult = SingleResult | ListResult | FileResult

type SegmentedMessage = AsyncGenerator[OverallResult, None]


class SegmentedResult(Protocol):
    key: Literal["segmented"]
    data: SegmentedMessage


type Result = SingleResult | ListResult | SegmentedResult


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


__all__ = ["SingleResult", "ListResult", "FileResult", "OverallResult", "SegmentedResult", "Result", "GroupResult", "PrivateResult"]
