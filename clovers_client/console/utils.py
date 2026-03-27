import hashlib


def md5(file: bytes):
    hash_md5 = hashlib.md5()
    hash_md5.update(file)
    return hash_md5.hexdigest()
