import hashlib
from base64 import b64encode
from pathlib import Path


def md5(data: bytes):
    hash_md5 = hashlib.md5()
    hash_md5.update(data)
    return hash_md5.hexdigest()


def upload(path: Path, data: bytes):
    index = md5(data)
    filepath = path / index
    if not filepath.exists():
        filepath.write_bytes(data)
    return f"/download/{index}"


def download(path: Path, index: str):
    filepath = path / index
    if not filepath.exists():
        return None
    return filepath.read_bytes()


def image_url(path: Path, url: str):
    if not url.startswith("/download/"):
        return url
    data = download(path, url[len("/download/") :])
    return f"data:image/png;base64,{ b64encode(data).decode()}" if data else None


def int32_id_generator():
    i = 0
    while True:
        yield str(i)
        i = (i + 1) & 0xFFFFFFFF
