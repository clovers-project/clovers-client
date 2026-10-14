# 架构说明

## 一句话概括

这是一个**单页聊天控制台**：`services/` 负责和后端说话，`store/` 保存状态，
`components/` 只负责把状态画出来。三者之间是单向依赖，不允许反向调用。

```
┌─────────────────────────────────────────────────────────────┐
│  components/            React 组件（只读 store，调 action）   │
│    ui/  layout/  chat/  overlays/                            │
└───────────────┬─────────────────────────────▲───────────────┘
                │ action 调用                  │ 订阅（zustand）
┌───────────────▼─────────────────────────────┴───────────────┐
│  store/                 zustand 状态容器                     │
│    bridge.ts  ← 唯一的装配层，把网络接进 store                │
│    session  chat  ui  settings  connection                   │
└───────────────┬─────────────────────────────▲───────────────┘
                │                              │ 回调
┌───────────────▼─────────────────────────────┴───────────────┐
│  services/              与外界打交道，不认识 React            │
│    client.ts（WebSocket/上传）  history.ts（IndexedDB）       │
│    legacy.ts（旧 HTML 快照迁移）                              │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│  lib/                   纯函数工具（格式化、MD5、导出…）       │
└─────────────────────────────────────────────────────────────┘
```

---

## 各层职责

### `types/protocol.ts`

两种类型混在一起，注意区分：

- **协议类型**（`ServerUserMessage`、`ClientUserMessage`、`ServerSystemMessage`）
  是与后端的契约，字段名不能随便改。
- **本地模型**（`ChatRecord`、`SystemRecord`、`FeedItem`）
  是前端自己的数据结构，可以自由演进，只要改 `toRecord()` 的转换逻辑。

### `services/`

| 文件 | 职责 | 关键点 |
| --- | --- | --- |
| `client.ts` | WebSocket 连接、自动重连、发送队列、文件上传、单条消息查询 | 离线时消息进队列，连上自动补发；上传前先用 MD5 探测服务端是否已有 |
| `db.ts` | IndexedDB 的连接与表结构（唯一出处） | 库名 `ChatAppDB`，v3；`messages` / `histories` / `assets` 三张表 |
| `history.ts` | 会话历史的读写封装 | 写入按会话串行化，避免并发覆盖 |
| `assets.ts` | 用户本地资源（目前是背景图） | 直接存 Blob，读出来再转成 object URL |
| `legacy.ts` | 旧版 HTML 快照 → 结构化消息 | 用 `DOMParser` 解析旧 DOM，再把 HTML 反推成 Markdown；解析失败不抛错 |

### `store/`

| Store | 管什么 | 不管什么 |
| --- | --- | --- |
| `session` | 身份列表、会话列表、当前选中项、@提及候选 | 消息内容 |
| `chat` | 消息数组、未读、列表摘要、发送与回显对账、引用缓存 | 网络细节（通过注入的 transport） |
| `ui` | 浮层开关、Toast、灯箱、输入框临时状态、草稿读写 | 任何业务数据 |
| `settings` | 外观（模式/主题色/圆角/密度/字号/毛玻璃/背景图参数）与偏好 | 图片本体 |
| `background` | 背景图的 object URL、取色结果 | 外观参数（存在 settings 里） |
| `connection` | 连接状态（connecting / online / offline） | 重连逻辑（在 `client.ts`） |

`store/bridge.ts` 是唯一的装配层：

- 创建 `CloversClient`，把 `onMessage` 接到 `chat.ingest()`，把 `onStateChange` 接到 `connection`
- 通过 `setTransport()` 把「真正发消息」和「按 ID 查消息」两个函数注入 `chat` store
  （这样 `chat` store 不 import 网络层，方便单测和离线演示）
- 导出 `actions`（跨模块的高层动作，如「切换会话并加载历史」「设置背景图」）

---

## 一次「收到消息」的完整链路

```
后端 WebSocket 推来 JSON
        │
        ▼
services/client.ts  onmessage → JSON.parse → options.onMessage(msg)
        │
        ▼
store/bridge.ts     useChat.getState().ingest(msg)
        │
        ▼
store/chat.ts       ingest()
        ├─ system 类型：log → localSystem()；title → 改名会话
        └─ user 类型：
             ├─ toRecord()  转成本地 ChatRecord（带本地时间戳）
             ├─ learnUser/learnGroup  更新「认识的人」目录（供 @ 补全）
             ├─ 会话不存在就自动建一个
             ├─ 带 echo 且能对上 pending 表？
             │     是 → 用服务端这条替换掉本地占位气泡（见下节）
             │     否 → 按 id 去重后追加
             ├─ set()  更新 feeds / summaries / unread / unreadAnchor
             ├─ historyStore.append()  异步落库
             └─ 非当前会话 且 未读为 0 时：桌面通知 + 提示音
        │
        ▼
React 重渲染 MessageList → MessageItem → Markdown 渲染
        │
        ▼
hooks/useAutoScroll  贴在底部就跟着滚，否则显示「有新消息」
```

## 一次「发送消息」的完整链路（含回显对账）

```
Composer.send()
  ├─ 有附件 → getClient().uploadFiles() 拿到 URL 列表（失败则中止）
  ├─ useChat.getState().send(text, images, at, reply)
  │     ├─ 生成一个随机的 echo 标记
  │     ├─ 乐观插入一条 status:'sending' 的本地消息（UI 立刻可见）
  │     ├─ 记入 pending[echo] = { groupId, localId }
  │     ├─ historyStore.append() 落库
  │     ├─ transport.send(payload, localId, groupId)  ← bridge 注入
  │     │      └─ 离线：标成 failed + Toast「消息已排队」
  │     └─ 起一个 12 秒兜底定时器（见下）
  └─ resetComposer() 清空附件/提及/回复，清掉草稿

服务端把这条消息广播回来（带上同一个 echo）
        │
        ▼
ingest() 发现 echo 命中 pending[echo]
  ├─ 从 feeds 里删掉本地占位那条
  ├─ 插入服务端这条（拿到真正的 messageId，status:'sent'）
  ├─ historyStore.remove(旧 localId) + historyStore.append(新的)
  └─ 清掉 pending[echo] 与兜底定时器
```

### 为什么要这么做

旧版是「发出去就不管，等服务端广播回来再渲染」。好处是不会重复，
坏处是自己的消息要等一个来回才出现，网络慢的时候体感很差。

新版改成乐观渲染 + 回显对账：

| 场景 | 行为 |
| --- | --- |
| 服务端支持 `echo`（推荐） | 气泡先显示「发送中…」，回显到达后**原地替换**成正式记录（拿到真正的 `messageId`） |
| 服务端不支持 `echo` | 退化为**按内容匹配**：广播里的发送者是自己、且文本/图片/回复/@列表与某个待确认的本地气泡完全一致时，认领并替换它。连续发两条一模一样的消息也能按先后顺序一一对上 |
| 完全没有回显（比如服务端不回广播） | 12 秒后自动把状态拨回「已发送」；气泡保留，不会卡在「发送中」 |
| 离线发送 | 消息进 `client` 的队列并标红提示，重连补发后同样走上面的对账 |
| 广播重复到达 | `ingest()` 里有按 `id` 去重的兜底，重复的直接丢弃 |

> `pending` 里的条目在超时后**不会**删除（只标记 `settled`）。
> 这是刻意的：删了的话，一个迟到很久的回显就会被当成新消息而多出一个气泡。

---

## 需要注意的几处设计决定

### 1. 历史只在首次打开会话时读一次

`chat.loaded[groupId]` 为 true 后不再读盘，之后全靠内存，因此切换会话是瞬时的。
代价是：刷新页面才会拿到其他标签页写入的新数据（本项目是单页应用，可以接受）。

### 2. `ensureLoaded` 必须「合并」而不是「覆盖」

打开会话要异步读 IndexedDB，而 WebSocket 上的新消息可能在这期间就到了内存。
`mergeFeed()` 按 `id` 去重后按时间排序再合并 —— 这是修过的一个真实 bug，
改这里时请保留这个行为。

### 3. 时间戳由前端生成且保证单调递增

后端消息不带时间。`monotonic()` 保证同一会话内后到的消息时间戳严格更大，
避免出现「先发的排在后面」。

### 4. 自动贴底一律用瞬时滚动

`useAutoScroll` 里跟随新消息用 `scrollTop = scrollHeight`，不用 `behavior:'smooth'`。
原因是动画在低性能设备或标签页被节流时会卡在半路，看起来就是「列表没滚到底」。
只有用户主动点「回到最新」才用平滑滚动。

### 5. 图片懒加载会改变内容高度

所以 `useAutoScroll` 里挂了 `ResizeObserver`：内容变高时，如果用户原本就贴底，
就继续保持贴底。

### 6. 主题切换是零重渲染的

`settings` store 只把设置写到 `<html>` 的 `data-*` 属性（和几个 CSS 变量）上，
颜色全部由 CSS 变量派生。所以切主题不会触发任何组件重渲染，也不会闪一下。

### 7. 背景图存在 IndexedDB，不存 localStorage

图片动辄几 MB，而 localStorage 只有约 5MB 且只能存字符串。
`services/assets.ts` 直接把 Blob 存进 IndexedDB 的 `assets` 表，
读出来再包成 object URL；换图/删除时记得 `URL.revokeObjectURL` 回收。

### 8. 主题色的自动提取是「加权色相直方图」

`lib/imageColor.ts` 不是取平均色（那通常会得到一团浑浊的灰），而是：
把图缩到 64×64 → 丢掉近黑/近白/灰的像素 → 按彩度和明度加权投进 24 个色相桶 →
取最重的桶并把左右邻居做圆周平均（避免 15° 边界跳变）。
顺带给出整图平均明度，用来建议亮色还是暗色模式。

---

## 构建与分包

`vite.config.ts` 里把不常变的依赖拆成独立 chunk：

| chunk | 内容 | gzip |
| --- | --- | --- |
| `vendor` | React、ReactDOM、zustand、lucide、idb、spark-md5 | ~78 KB |
| `vendor-markdown` | marked + highlight.js（按需注册语言） | ~57 KB |
| `index` | 业务代码 | ~31 KB |

> highlight.js 如果直接 `import hljs from 'highlight.js'` 会把所有语言打进来
> （约 900 KB）。`chat/Markdown.tsx` 里显式 import 并注册了 27 种常用语言，
> 需要更多语言往那个清单里加一行即可。
