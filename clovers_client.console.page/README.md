# clovers 终端 · Web 控制台

一个聊天式控制台前端：左侧会话列表，右侧消息流，通过 WebSocket 与后端通信，
支持 Markdown 渲染、代码高亮、图片收发、@提及、回复引用、会话历史本地持久化。

界面默认是 **Windows 10 那种直棱直角 + 扁平 + 亚克力** 的风格，
内置 8 套主题色 × 亮/暗，还支持**用自己的图片当背景并自动从图里取主题色**。

当前版本是基于 **React 19 + TypeScript + Vite 7 + Tailwind CSS v4** 的完整重构版。

![暗色主题](docs/screenshots/dark.png)

---

## 快速开始

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器（默认 http://localhost:5173）
npm run build        # 类型检查 + 生产构建，产物在 dist/
npm run serve        # 用本地演示服务器托管 dist/（无需后端即可看效果）
```

> **关于后端**：开发时 Vite 会把 `/ws`、`/upload`、`/download`、`/message`
> 反向代理到后端，默认目标是 `http://127.0.0.1:11000`，可以用环境变量改：
>
> ```bash
> CLOVERS_BACKEND=http://192.168.1.10:11000 npm run dev
> ```
>
> 想在没有后端的情况下先看界面，直接 `npm run serve` 即可 —— 它会起一个零依赖的
> 演示服务器，自带假数据、回声机器人，并实现了 `/upload`、`/download`、`/message`。

---

## 命令一览

| 命令                 | 作用                                                          |
| -------------------- | ------------------------------------------------------------- |
| `npm run dev`        | 开发服务器，带 HMR 与后端代理                                 |
| `npm run build`      | `tsc --noEmit` 类型检查 + Vite 生产构建                       |
| `npm run build:only` | 跳过类型检查，只打包（应急用）                                |
| `npm run typecheck`  | 只做类型检查                                                  |
| `npm run preview`    | Vite 自带的产物预览                                           |
| `npm run serve`      | 零依赖静态服务器 + 假后端（`scripts/mock-server.mjs`）        |
| `npm run shots`      | 重新生成 `docs/screenshots/` 的文档截图（需先 build + serve） |

---

## 目录结构

```
.
├─ index.html                  # 入口 HTML（含首屏防闪主题脚本）
├─ vite.config.ts              # 构建配置 + 开发代理 + 分包策略
├─ docs/                       # 文档与截图
├─ scripts/
│  ├─ mock-server.mjs          # 零依赖演示服务器（静态托管 + 假 /ws + 假 /upload + 假 /message）
│  └─ capture-screenshots.mjs  # 生成文档截图（headless Chrome/Edge）
└─ src/
   ├─ main.tsx                 # React 挂载入口
   ├─ App.tsx                  # 应用骨架：布局 + 全局快捷键 + 浮层装配
   ├─ types/protocol.ts        # 与后端的协议类型、本地消息模型
   ├─ styles/                  # 设计令牌与全局样式（见 docs/THEMING.md）
   ├─ lib/                     # 无状态工具：格式化、存储、MD5、导出、搜索高亮…
   ├─ services/                # 与外界打交道：WebSocket、IndexedDB、旧数据迁移
   ├─ store/                   # 状态层（zustand）：session / chat / ui / settings / connection
   ├─ hooks/                   # 可复用 React Hook：快捷键、自动贴底、点击外部…
   └─ components/
      ├─ ui/                   # 通用控件：Button / Modal / Menu / Avatar / Toasts…
      ├─ layout/               # 布局：Sidebar / ChatHeader / 会话列表项
      ├─ chat/                 # 聊天：MessageList / MessageItem / Composer / Markdown…
      └─ overlays/             # 浮层：命令面板 / 设置 / 图片灯箱 / 会话与身份管理
```

**分层规则**（改代码时请遵守，否则很容易绕成一团）：

```
components  →  store  →  services  →  lib
     ↓            ↓
   hooks        types
```

- 组件只读 store、调 store 的 action，**不直接发网络请求、不直接写 IndexedDB**
- `services/` 不认识 React，也不碰 DOM（除了旧数据迁移里的 `DOMParser`）
- `lib/` 全是纯函数，最好连 store 都不依赖
- 例外：`store/bridge.ts` 是唯一把网络层接到状态层的地方

---

## 功能地图

| 功能                                   | 去哪里找                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| 多主题 / 明暗 / 密度 / 字号 / 直角圆润 | `store/settings.ts`、`styles/themes.css`、`overlays/SettingsPanel.tsx`       |
| 自定义背景图 + 自动取色                | `store/background.ts`、`lib/imageColor.ts`、`layout/BackgroundLayer.tsx`     |
| 命令面板（Ctrl/⌘ + K）                 | `overlays/CommandPalette.tsx`                                                |
| 会话内搜索（Ctrl/⌘ + F）               | `chat/SearchBar.tsx`、`lib/searchHighlight.ts`                               |
| 消息渲染 / 代码高亮 / 复制             | `chat/Markdown.tsx`、`styles/markdown.css`、`styles/highlight.css`           |
| 发送中状态 / 回显对账                  | `store/chat.ts` 的 `send()` 与 `ingest()`                                    |
| 引用消息补全（`/message/{id}`）        | `services/client.ts`、`store/chat.ts` 的 `ensureQuote()`                     |
| 图片上传 / 预览 / 灯箱                 | `chat/Composer.tsx`、`chat/AttachmentTray.tsx`、`overlays/ImageLightbox.tsx` |
| 未读计数 / 桌面通知                    | `store/chat.ts`                                                              |
| 历史持久化                             | `services/history.ts`、`services/db.ts`（IndexedDB）                         |
| 旧版本数据迁移                         | `services/legacy.ts`                                                         |
| 导出会话                               | `lib/export.ts`                                                              |
| 快捷键                                 | `hooks/useHotkeys.ts`、`App.tsx`                                             |

完整功能说明见 **[docs/FEATURES.md](docs/FEATURES.md)**。

---

## 界面预览

| 暗色（靛蓝）                       | 亮色（海蓝）                         |
| ---------------------------------- | ------------------------------------ |
| ![dark](docs/screenshots/dark.png) | ![light](docs/screenshots/light.png) |

| 命令面板                                         | 外观设置                                   |
| ------------------------------------------------ | ------------------------------------------ |
| ![palette](docs/screenshots/command-palette.png) | ![settings](docs/screenshots/settings.png) |

| 8 套主题色 × 亮暗                      | 移动端                                 |
| -------------------------------------- | -------------------------------------- |
| ![themes](docs/screenshots/themes.png) | ![mobile](docs/screenshots/mobile.png) |

---

## 与旧版本的兼容性

重构**没有**改变与后端的任何约定，也没有丢弃用户已有数据：

- WebSocket 路径、消息 JSON 字段（`type/text/images/at/reply/senderId/...`）完全一致
- 上传方式一致：`POST /upload`（multipart 字段 `file`）+ `GET /download/<name>?check=true` 去重探测
- `localStorage` 沿用旧键名：`userId` / `groupId` / `userList` / `groupList` / `atbot`
- IndexedDB 还是 `ChatAppDB`，从 v1 升到 v3；旧版存在 `histories` 里的 HTML 快照
  会在打开会话时**尽力解析成结构化消息**并迁移，迁移后旧记录才会删除

新增（都是可选的，后端不实现也不影响使用）：

- 客户端发送的消息会带一个可选的 `echo` 字段，服务端原样广播回来即可实现
  「发送中 → 已送达」的状态对账（详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)）
- `GET /message/{message_id}` 用于补全本地没有的引用消息

> 已知差异：旧版处理 `{type:"system", data:["title", groupId, newName]}` 时，
> 误把命令名 `"title"` 当成了会话名。新版改成使用第三个元素（真正的名称）。
> 如果你的后端依赖这个错误行为，请改 `store/chat.ts` 的 `ingest()`。

---

## 文档索引

| 文档                                         | 内容                                           |
| -------------------------------------------- | ---------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构、数据流、目录职责、一次消息收发的完整链路 |
| [docs/FEATURES.md](docs/FEATURES.md)         | 每个功能的用法与实现位置                       |
| [docs/THEMING.md](docs/THEMING.md)           | 主题系统原理，以及「怎么加一套新主题色」       |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md)   | 常见改动怎么做、坑与注意事项、部署说明         |

---

## 部署

```bash
npm run build
```

把 `dist/` 里的内容放到后端静态目录即可（旧版本默认输出到
`../clovers_client/console/page`，需要的话把 `vite.config.ts` 里的
`build.outDir` 改回去）。

产物是纯静态文件，但**必须**由能提供 `/ws`、`/upload`、`/download` 的服务托管，
否则界面能打开但连不上后端。

### 后端接口要求

| 方法 | 路径                    | 说明                                         |
| ---- | ----------------------- | -------------------------------------------- |
| WS   | `/ws`                   | 双向 JSON 消息，同旧版                       |
| POST | `/upload`               | multipart，字段名 `file`                     |
| GET  | `/download/{name}`      | 返回文件；`?check=true` 时只探测是否存在     |
| GET  | `/message/{message_id}` | 可选。返回单条消息 JSON，用于补全引用内容    |
| —    | 消息字段 `echo`         | 可选。把客户端给的 `echo` 原样带回广播里即可 |
