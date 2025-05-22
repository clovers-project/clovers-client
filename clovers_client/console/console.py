import sys
import asyncio
import websockets


async def main(port: int):
    async with websockets.serve(lambda ws: ws.send(input("Enter message:")), "127.0.0.1", port):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main(int(sys.argv[1])))
