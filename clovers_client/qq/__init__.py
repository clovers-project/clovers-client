from pathlib import Path
import botpy
from botpy.message import Message, GroupMessage
from clovers import Client as CloversClient, Leaf
from clovers.utils import list_modules
from .adapters.group import __adapter__ as group_adapter
from .adapters.guild import __adapter__ as guild_adapter
from .config import __config__


appid = __config__.appid
secret = __config__.secret
Bot_Nickname = __config__.Bot_Nickname


class LeafGroup(Leaf):
    def __init__(self, name="QQ-Group"):
        super().__init__(name)
        self.adapter.update(group_adapter)
        for adapter in __config__.group_adapters:
            self.load_adapter(adapter)
        for adapter_dir in __config__.group_adapter_dirs:
            adapter_dir = Path(adapter_dir)
            if not adapter_dir.exists():
                adapter_dir.mkdir(parents=True, exist_ok=True)
                continue
            for adapter in list_modules(adapter_dir):
                self.load_adapter(adapter)

    def extract_message(self, event: Message, **ignore) -> str | None:
        content = event.content
        for user in event.mentions:
            content = content.replace(f"<@!{user.id}>", "")
        return content.lstrip(" ")


class LeafGuild(Leaf):
    def __init__(self, name="QQ-Guild"):
        super().__init__(name)
        self.adapter.update(guild_adapter)
        for adapter in __config__.guild_adapters:
            self.load_adapter(adapter)
        for adapter_dir in __config__.guild_adapter_dirs:
            adapter_dir = Path(adapter_dir)

    def extract_message(self, event: Message, **ignore) -> str | None:
        return event.content.lstrip(" ")


class QQBotClient(botpy.Client):
    def __init__(self):
        super().__init__(botpy.Intents(public_guild_messages=True, public_messages=True))
        self.leaf_group = LeafGroup()
        self.leaf_guild = LeafGuild()

    async def on_group_at_message_create(self, message: GroupMessage):
        await self.leaf_group.response(client=self, event=message, to_me=True)

    async def on_at_message_create(self, message: Message):
        await self.leaf_guild.response(client=self, event=message, to_me=True)


class Client(CloversClient):
    def __init__(self, name="QQBotSDK"):
        self.name = name
        super().__init__()
        self.client = QQBotClient()
        # 下面是获取配置
        for plugin in __config__.plugins:
            self.load_plugin(plugin)
        for plugin_dir in __config__.plugin_dirs:
            plugin_dir = Path(plugin_dir)
            if not plugin_dir.exists():
                plugin_dir.mkdir(parents=True, exist_ok=True)
                continue
            for plugin in list_modules(plugin_dir):
                self.load_plugin(plugin)

    def plugins_ready(self):
        self.client.leaf_group.plugins.extend(self.plugins)
        self.client.leaf_group.plugins_ready()
        self.client.leaf_guild.plugins.extend(self.plugins)
        self.client.leaf_guild.plugins_ready()

    async def run(self):
        async with self:
            async with self.client:
                await self.client.start(appid=appid, secret=secret)
