from typing import TypedDict, Literal
from collections.abc import AsyncGenerator, Sequence
from pathlib import Path
from io import BytesIO
from clovers import Result as CloversResult

type FileLike = str | bytes | BytesIO | Path

type JsonBaseType = str | int | float | bool | None
type JsonArray = list[JsonBaseType]
type JsonObject = dict[str, JsonBaseType | JsonArray]
type JsonType = JsonBaseType | JsonArray | JsonObject


type SequenceMessage = Sequence[SingleResult]
type SegmentedMessage = AsyncGenerator[OverallResult, None]

type AtResult = CloversResult[Literal["at"], str]
type TextResult = CloversResult[Literal["text"], str]
type ImageResult = CloversResult[Literal["image"], FileLike]
type SingleResult = AtResult | TextResult | ImageResult
type SequenceResult = CloversResult[Literal["list"], SequenceMessage]
type VoiceResult = CloversResult[Literal["voice"], FileLike]
type VideoResult = CloversResult[Literal["video"], FileLike]
type FileResult = CloversResult[Literal["file"], FileLike]
type ConsoleResult = CloversResult[Literal["console"], list[str]]
type OverallResult = SingleResult | SequenceResult | FileResult | VoiceResult | VideoResult | ConsoleResult
type SegmentedResult = CloversResult[Literal["segmented"], SegmentedMessage]
type Result = OverallResult | SegmentedResult
type PrivateResult = CloversResult[Literal["private_message"], PrivateMessage]
type GroupResult = CloversResult[Literal["group_message"], GroupMessage]


class PrivateMessage(TypedDict):
    user_id: str
    data: Result


class GroupMessage(TypedDict):
    group_id: str
    data: Result


__all__ = ["SingleResult", "OverallResult", "SegmentedResult", "Result", "PrivateResult", "GroupResult"]
