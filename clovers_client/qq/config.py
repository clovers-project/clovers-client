from pydantic import BaseModel
from clovers.config import Config as CloversConfig
from functools import cache


class Intents(BaseModel):
    public_messages: bool = True
    """群/C2C公域消息事件"""
    public_guild_messages: bool = True
    """公域消息事件"""
    guild_messages: bool = False
    """消息事件 (仅 私域 机器人能够设置此 intents)"""
    direct_message: bool = True
    """私信事件"""
    guild_message_reactions: bool = True
    """消息相关互动事件"""
    guilds: bool = True
    """频道事件"""
    guild_members: bool = True
    """频道成员事件"""
    interaction: bool = True
    """互动事件"""
    message_audit: bool = True
    """消息审核事件"""
    forums: bool = False
    """论坛事件 (仅 私域 机器人能够设置此 intents)"""
    audio_action: bool = True
    """音频事件"""


class LeafConfig(BaseModel):
    enabled: bool = True
    adapters: list[str] = []
    adapter_dirs: list[str] = []
    plugins: list[str] = []
    plugin_dirs: list[str] = []


class Config(BaseModel):
    Bot_Nickname: str = "Bot酱"
    superusers: set[str] = set()
    appid: str = ""
    secret: str = ""
    group_config: LeafConfig = LeafConfig(adapters=["~adapters.group"])
    guild_config: LeafConfig = LeafConfig(adapters=["~adapters.guild"])
    intents: Intents = Intents()

    @classmethod
    @cache
    def sync_config(cls):
        __config_dict__: dict = CloversConfig.environ().setdefault("clovers", {})
        __config_dict__.update((__config__ := cls.model_validate(__config_dict__)).model_dump())
        return __config__
