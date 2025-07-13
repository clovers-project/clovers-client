from pydantic import BaseModel
from clovers_client.config import Config as BaseConfig


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


class AdapterConfig(BaseModel):
    enabled: bool = True
    adapters: list[str] = []
    adapter_dirs: list[str] = []


class Config(BaseConfig):
    Bot_Nickname: str = "Bot酱"
    appid: str = ""
    secret: str = ""
    intents: Intents = Intents()
    group_config: AdapterConfig = AdapterConfig(adapters=["clovers_client.qq.adapters.group"])
    guild_config: AdapterConfig = AdapterConfig(adapters=["clovers_client.qq.adapters.guild"])
    plugins: list[str] = []
    plugin_dirs: list[str] = []
