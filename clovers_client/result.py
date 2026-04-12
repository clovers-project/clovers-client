from typing import TypedDict, Literal
from collections.abc import AsyncGenerator, Sequence
from clovers import Result as CloversResult
from .utils import FileLike

type JsonBaseType = str | int | float | bool | None
type JsonArray = list[JsonBaseType]
type JsonObject = dict[str, JsonBaseType | JsonArray]
type JsonType = JsonBaseType | JsonArray | JsonObject


type SequenceMessage = Sequence[SingleResult]
type SegmentedMessage = AsyncGenerator[OverallResult, None]
type MergeForwardMessage = Sequence[SingleResult | SequenceResult]

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
type PrivateResult = CloversResult[Literal["private_message"], PrivateMessage]
type GroupResult = CloversResult[Literal["group_message"], GroupMessage]
type MergeForwardResult = CloversResult[Literal["merge_forward"], MergeForwardMessage]


class PrivateMessage(TypedDict):
    user_id: str
    data: OverallResult | SegmentedResult


class GroupMessage(TypedDict):
    group_id: str
    data: OverallResult | SegmentedResult


__all__ = ["SingleResult", "SequenceResult", "OverallResult", "SegmentedResult", "PrivateResult", "GroupResult", "MergeForwardResult"]
