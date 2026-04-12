from pathlib import Path
from io import BytesIO
from base64 import b64encode
from datetime import datetime

type FileLike = str | bytes | BytesIO | Path


# def format_file(file: FileLike) -> str: ...
def int32_id_generator():
    i = 0
    while True:
        yield str(i)
        i = (i + 1) & 0xFFFFFFFF


def b64url(data: bytes):
    return f"base64://{b64encode(data).decode()}"


def f2s(file: FileLike) -> str:
    match file:
        case str():
            return file
        case Path():
            return file.resolve().as_uri()
        case BytesIO():
            return b64url(file.getvalue())
        case _:
            return b64url(file)


def f2b(file: FileLike) -> str:
    match file:
        case str():
            if file.startswith("http") or file.startswith("base64://"):
                return file
            data = (Path(file[:7]) if file.startswith("file://") else Path(file)).read_bytes()
        case Path():
            data = file.read_bytes()
        case BytesIO():
            data = file.getvalue()
        case _:
            data = file
    return b64url(data)


def format_filename(file: FileLike) -> str:
    match file:
        case str():
            if "/" in file:
                name = file.rsplit("/", 1)[-1]
                if "." not in name:
                    name += ".txt"
            elif "\\" in file:
                name = file.rsplit("\\", 1)[-1]
                if "." not in name:
                    name += ".txt"
            else:
                name = f"{datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}.txt"
        case Path():
            name = file.name
        case _:
            name = f"{datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}.txt"
    return name
