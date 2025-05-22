# Clovers Client

插件的优先级：

有 5 个插件注册了响应优先级为分别为 1，2，3 的响应任务，代码分别如下：

```python
from clovers import Plugin, Event, Result

plugin = Plugin(priority=1, block=False)


@plugin.handle(["你好"], priority=1, block=False)
async def _(event: Event):
    return Result("text", "你好1-1")


@plugin.handle(["你好"], priority=2, block=True)
async def _(event: Event):
    return Result("text", "你好1-2")


@plugin.handle(["你好"], priority=3, block=False)
async def _(event: Event):
    return Result("text", "你好1-3")


__plugin__ = plugin
```

```python
from clovers import Plugin, Event, Result

plugin = Plugin(priority=1, block=False)


@plugin.handle(["你好"], priority=1, block=False)
async def _(event: Event):
    return Result("text", "你好2-1")


@plugin.handle(["你好"], priority=2, block=False)
async def _(event: Event):
    return Result("text", "你好2-2")


@plugin.handle(["你好"], priority=3, block=False)
async def _(event: Event):
    return Result("text", "你好2-3")


__plugin__ = plugin
```

```python
from clovers import Plugin, Event, Result

plugin = Plugin(priority=2, block=False)


@plugin.handle(["你好"], priority=1, block=False)
async def _(event: Event):
    return Result("text", "你好3-1")


@plugin.handle(["你好"], priority=2, block=True)
async def _(event: Event):
    return Result("text", "你好3-2")


@plugin.handle(["你好"], priority=3, block=False)
async def _(event: Event):
    return Result("text", "你好3-3")


__plugin__ = plugin
```

```python
from clovers import Plugin, Event, Result

plugin = Plugin(priority=2, block=True)


@plugin.handle(["你好"], priority=1, block=False)
async def _(event: Event):
    return Result("text", "你好4-1")


@plugin.handle(["你好"], priority=2, block=False)
async def _(event: Event):
    return Result("text", "你好4-2")


@plugin.handle(["你好"], priority=3, block=False)
async def _(event: Event):
    return Result("text", "你好4-3")


__plugin__ = plugin
```

```python
from clovers import Plugin, Event, Result

plugin = Plugin(priority=3, block=True)


@plugin.handle(["你好"], priority=1, block=False)
async def _(event: Event):
    return Result("text", "你好5-1")


__plugin__ = plugin
```

```bash
Enter Message:你好
[TEXT] 你好1-1
[TEXT] 你好2-1
[TEXT] 你好1-2
[TEXT] 你好2-2
[TEXT] 你好3-1
[TEXT] 你好4-1
[TEXT] 你好3-2
[TEXT] 你好4-2
```

执行顺序:

插件 1, 2 同时响应优先级为 1 的任务
插件 1, 2 同时响应优先级为 2 的任务
插件 1 的 2 级响应阻断了后续响应导致插件 1，2 的 3 级响应不执行
插件 3, 4 同时响应优先级为 1 的任务
插件 3, 4 同时响应优先级为 2 的任务
插件 3 的 2 级响应阻断了后续响应导致插件 3，4 的 3 级响应不执行
插件 4 设置了阻断导致后续插件不执行
