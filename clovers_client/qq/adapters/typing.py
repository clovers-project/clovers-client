from pathlib import Path
from collections.abc import AsyncGenerator
from clovers import Result
from io import BytesIO


type ListMessage = list[Result]
type SegmentedMessage = AsyncGenerator[Result, None]
type FileLike = str | bytes | BytesIO | Path
