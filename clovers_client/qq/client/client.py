import botpy
from botpy.message import Message, GroupMessage
from clovers import Leaf, Client
from .config import Config

__config__ = Config.sync_config()

BOT_NICKNAME = __config__.Bot_Nickname
LEN_BOT_NICKNAME = len(BOT_NICKNAME)


class GroupBot(Leaf):
    def __init__(self):
        super().__init__("QQ Group")
        self.load_adapters_from_list(__config__.group_config.adapters)
        self.load_adapters_from_dirs(__config__.group_config.adapter_dirs)
        self.load_plugins_from_list(__config__.plugins)
        self.load_plugins_from_dirs(__config__.plugin_dirs)

    def extract_message(self, event: Message, **ignore) -> str | None:
        content = event.content
        for user in event.mentions:
            content = content.replace(f"<@!{user.id}>", "")
        return content.lstrip(" ")


class GuildBot(Leaf):
    def __init__(self):
        super().__init__("QQ Guild")
        self.load_adapters_from_list(__config__.guild_config.adapters)
        self.load_adapters_from_dirs(__config__.guild_config.adapter_dirs)
        self.load_plugins_from_list(__config__.plugins)
        self.load_plugins_from_dirs(__config__.plugin_dirs)

    def extract_message(self, event: Message, **ignore) -> str | None:
        return event.content.lstrip(" ")


class QQBot(botpy.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if __config__.guild_config.enabled:
            self.guild_bot = GuildBot()
        if __config__.group_config.enabled:
            self.group_bot = GroupBot()

    def on_at_message_create(self, message: Message):
        return self.guild_bot.response(client=self, event=message, to_me=True)

    def on_group_at_message_create(self, message: GroupMessage):
        return self.group_bot.response(client=self, event=message, to_me=True)


class QQBotClient(Client):
    def __init__(self):
        super().__init__()
        self.name = "QQBotSDK"
        self.appid = __config__.appid
        self.secret = __config__.secret
        self.bot = QQBot(botpy.Intents(**__config__.intents.model_dump()))

    def initialize_plugins(self):
        if hasattr(self.bot, "group_bot"):
            self.bot.group_bot.initialize_plugins()
        if hasattr(self.bot, "guild_bot"):
            self.bot.guild_bot.initialize_plugins()

    async def run(self):
        async with self:
            async with self.bot:
                await self.bot.start(appid=self.appid, secret=self.secret)


__client__ = QQBotClient()
