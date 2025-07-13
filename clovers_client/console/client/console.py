import sys
import asyncio
import websockets


async def send(ws: websockets.ServerConnection):
    while True:
        print("Enter message: ", end="")
        await ws.send(await asyncio.to_thread(input))


async def receive(ws: websockets.ServerConnection):
    while True:
        message = await ws.recv()
        print(f"\r               \r{message}\nEnter message: ", end="")


async def send_and_receive(ws: websockets.ServerConnection):
    await asyncio.gather(send(ws), receive(ws))


async def main(port: int):
    async with websockets.serve(send_and_receive, "127.0.0.1", port):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main(int(sys.argv[1])))
