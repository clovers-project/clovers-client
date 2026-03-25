import botpy
from botpy.message import Message, GroupMessage
from clovers import Leaf, Client
from .config import Config


class GroupBot(Leaf):
    def __init__(self, config: Config):
        super().__init__("QQ Group")
        self.load_adapters_from_list(config.group_config.adapters)
        self.load_adapters_from_dirs(config.group_config.adapter_dirs)
        self.load_plugins_from_list(config.plugins)
        self.load_plugins_from_dirs(config.plugin_dirs)

    def extract_message(self, event: Message, **ignore) -> str | None:
        content = event.content
        for user in event.mentions:
            content = content.replace(f"<@!{user.id}>", "")
        return content.lstrip(" ")


class GuildBot(Leaf):
    def __init__(self, config: Config):
        super().__init__("QQ Guild")
        self.load_adapters_from_list(config.guild_config.adapters)
        self.load_adapters_from_dirs(config.guild_config.adapter_dirs)
        self.load_plugins_from_list(config.plugins)
        self.load_plugins_from_dirs(config.plugin_dirs)

    def extract_message(self, event: Message, **ignore) -> str | None:
        return event.content.lstrip(" ")


class QQBot(botpy.Client):
    def __init__(self, guild_bot: GuildBot | None, group_bot: GroupBot | None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if guild_bot:
            self.guild_bot = guild_bot
            self.on_at_message_create = self._on_at_message_create
        if group_bot:
            self.on_group_at_message_create = self._on_group_at_message_create
            self.group_bot = group_bot

    def _on_at_message_create(self, message: Message):
        return self.guild_bot.response(client=self, event=message, to_me=True)

    def _on_group_at_message_create(self, message: GroupMessage):
        return self.group_bot.response(client=self, event=message, to_me=True)


class QQBotClient(Client):
    def __init__(self, config: Config = Config.sync_config()):
        super().__init__()
        self.BOT_NICKNAME = config.Bot_Nickname
        self._length_bot_nickname = len(self.BOT_NICKNAME)
        self.name = "QQBotSDK"
        self.appid = config.appid
        self.secret = config.secret
        self.bot = QQBot(
            GuildBot(config) if config.guild_config.enabled else None,
            GroupBot(config) if config.group_config.enabled else None,
            botpy.Intents(**config.intents.model_dump()),
        )

    def initialize_plugins(self):
        if hasattr(self.bot, "group_bot"):
            self.bot.group_bot.initialize_plugins()
        if hasattr(self.bot, "guild_bot"):
            self.bot.guild_bot.initialize_plugins()

    async def run(self):
        async with self:
            async with self.bot:
                await self.bot.start(appid=self.appid, secret=self.secret)
