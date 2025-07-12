import asyncio

from clovers_client.onebot.v11 import Client as Client

# from clovers_client.console import Client as Client

client = Client()
asyncio.run(client.run())
