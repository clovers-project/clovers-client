import asyncio
from clovers_client.onebot.v11.client import __client__ as client

# from clovers_client.console.client import __client__ as client
# from clovers_client.qq.client import __client__ as client


asyncio.run(client.run())
