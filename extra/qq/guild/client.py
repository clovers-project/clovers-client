import botpy
from botpy.message import Message, GroupMessage
from clovers import Leaf, Client
from .adapter import __adapter__
from ..config import Config


class QQGuildClient(botpy.Client):
    def __init__(self, client: "QQGuildSDKClient", intents: dict):
        super().__init__(botpy.Intents(**intents))
        self.client = client

    def _on_at_message_create(self, message: GroupMessage):
        print(message)
        return self.client.response(
            client=self,
            event=message,
            to_me=True,
            bot_name=self.client.BOT_NICKNAME,
            superusers=self.client.SUPERUSERS,
        )


class QQGuildSDKClient(Leaf, Client):
    def __init__(self, config: Config = Config.sync_config()):
        super().__init__("QQ Group SDK")
        self.adapter.update(__adapter__)
        self.load_adapters_from_list(config.adapters)
        self.load_adapters_from_dirs(config.adapter_dirs)
        self.load_plugins_from_list(config.plugins)
        self.load_plugins_from_dirs(config.plugin_dirs)
        # inner
        self.BOT_NICKNAME = config.BOT_NICKNAME
        self.SUPERUSERS = config.SUPERUSERS
        self._length_bot_nickname = len(self.BOT_NICKNAME)
        # QQBotSDK
        self.appid = config.appid
        self.secret = config.secret
        self.bot = QQGuildClient(self, config.intents.model_dump())

    def extract_message(self, event: Message, **ignore) -> str | None:
        return event.content.lstrip(" ")

    async def run(self):
        async with self:
            async with self.bot:
                await self.bot.start(appid=self.appid, secret=self.secret)
