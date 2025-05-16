from pathlib import Path
from collections.abc import AsyncGenerator
from clovers import Result
from io import BytesIO


type ListResult = list[Result]
type SegmentedResult = AsyncGenerator[Result, None]
type FileLike = str | bytes | BytesIO | Path
