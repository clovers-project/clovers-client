from pydantic import BaseModel
from clovers.core.config import config


class Config(BaseModel):
    plugins_path: str = "./clovers_library"
    plugins_list: list = []


config_key = "clovers"
config_data = Config.model_validate(config.get(config_key, {}))
config[config_key] = config_data.model_dump()
