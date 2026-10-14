# 维护指南

面向接手的人：常见改动怎么做、有哪些坑、怎么部署。

---

## 1. 开发环境

```bash
npm install
npm run dev        # http://localhost:5173，/ws /upload /download 自动代理到后端
```

默认后端是 `http://127.0.0.1:8080`，用环境变量改：

```bash
CLOVERS_BACKEND=http://192.168.1.10:8080 npm run dev
```

**没有后端也能开发界面**：

```bash
npm run build && npm run serve     # 零依赖演示服务器 + 假 /ws + 假 /upload
MOCK_INSTANT=1 npm run serve       # 演示消息立刻推送（适合截图/自动化）
```

---

## 2. 常见改动：怎么做

### 「我要加一个新按钮到会话标题栏」

改 `src/components/layout/ChatHeader.tsx`，用现成的 `<IconButton>`。
如果是窄屏下会被挤掉的功能，记得加 `className="max-[640px]:hidden"`
并往「更多」菜单（同一个文件里的 `<Menu items={...} />`）里补一条。

### 「我要加一个全局快捷键」

在 `src/App.tsx` 的 `hotkeys` 数组里加一条：

```ts
{ combo: 'mod+shift+p', handler: () => { /* ... */ } },
```

- `mod` = `Ctrl`（Mac 上是 `⌘`）
- 默认在输入框聚焦时不触发；确实需要在输入框里也生效就加 `allowInInput: true`
- 加完顺手更新 `overlays/ShortcutHelp.tsx` 里的说明表

### 「我要加一个新的浮层」

1. 在 `src/store/ui.ts` 的 `OverlayId` 联合类型里加名字
2. 在 `src/components/overlays/` 下写组件，接收 `{ onClose }`
3. 在 `src/App.tsx` 里加一行条件渲染

浮层内部请用 `src/components/ui/Modal.tsx`，它已经处理好了 Esc 关闭、
点遮罩关闭、滚动锁定和初始焦点。

### 「我要加一个 Toast」

```ts
import { toast } from '@/store/ui';
toast.success('标题', '可选的说明');
toast.error('出错了');
```

不需要放在组件里，任何地方都能调。

### 「我要改消息的渲染方式」

- 整体排版：`src/components/chat/MessageItem.tsx`
- Markdown/代码块：`src/components/chat/Markdown.tsx` + `src/styles/markdown.css`
- 代码配色：`src/styles/highlight.css`（亮/暗各一套）

### 「我要加一种代码高亮语言」

`src/components/chat/Markdown.tsx` 顶部：

```ts
import dart from 'highlight.js/lib/languages/dart';
// ...
const LANGUAGES = { /* ... */ dart };
```

需要短别名（比如 `dart` 想用 ```` ```dart ```` 之外还支持别的写法）就加进 `ALIASES`。
**不要**改成 `import hljs from 'highlight.js'`，那会把所有语言打进来，
包体积会从 ~57KB 涨到 ~900KB。

### 「我要改后端地址 / 上传接口」

`src/services/client.ts`。里面有三个私有字段 `wsUrl` / `uploadUrl` / `downloadUrl`。
开发时的代理规则在 `vite.config.ts`。

### 「我要加一个新的偏好设置」

1. `src/store/settings.ts` 的 `Preferences` 接口加字段 + `DEFAULT_PREFERENCES` 加默认值
2. `src/components/overlays/SettingsPanel.tsx` 里加一个 `<Switch>` 或 `<Segmented>`

持久化是自动的（`setPreference` 会写 localStorage）。

外观类的设置（要写进 `data-*` 的）走 `Appearance` + `setAppearance`，
并在 `applyAppearance()` 里加一行写 DOM 属性的代码，**同时别忘了改
`index.html` 里的防闪脚本**。

### 「我要换掉背景图取色的算法」

只改 `src/lib/imageColor.ts` 的 `extractPalette()`，返回 `{ hue, saturation, lightness, hex, suggestDark }`
即可，其余代码不用动。

### 「我要让引用消息能显示更长的原文」

`store/chat.ts` 的 `ensureQuote()` 里用了 `summarize(text, 120)`，改这个数字就行。

---

## 3. 坑与注意事项

### ⚠️ `ensureLoaded` 必须合并而不是覆盖

`src/store/chat.ts` 的 `mergeFeed()`。打开会话要异步读 IndexedDB，
新消息可能在这期间已经到了内存。直接 `feeds[groupId] = items` 会让先到的实时消息
凭空消失。这个 bug 修过一次，别再改回去。

### ⚠️ 自动贴底不要用平滑滚动

`src/hooks/useAutoScroll.ts` 里跟随新消息是 `el.scrollTop = el.scrollHeight`。
改成 `behavior:'smooth'` 之后，在低性能设备或标签页被浏览器节流时，动画会卡在
半路，用户看到的就是「列表没滚到底」。只有点「回到最新」按钮才用平滑滚动。

### ⚠️ 修改默认外观要改两处

`index.html` 里的内联防闪脚本 + `src/store/settings.ts` 的 `DEFAULT_APPEARANCE`。
只改一处会出现首屏闪烁。

### ⚠️ 颜色不要写死在组件里

组件里写 `text-blue-500` 之类的固定色会导致切主题时那块不跟着变。
一律用语义类：`bg-surface`、`text-muted`、`bg-accentsoft`、`text-danger`…

### ⚠️ 主题色变量命名

自定义圆角变量用 `--r-*` 前缀（`--r-md`），**不要**用 `--radius-*` ——
那是 Tailwind 自带的命名空间，会互相覆盖。

### ⚠️ 移动端 flex 的 min-width

气泡、输入框这类可能被长内容（尤其是不换行的代码块）撑开的元素，
必须带 `min-w-0` / `max-w-full`。`align-items` 不是 `stretch` 时，
flex 子项会按 max-content 撑开并把整个页面顶宽，在手机上是肉眼可见的错位。

### ⚠️ 消息 id 不要用来拼 CSS 选择器

服务端给的 `messageId` 可能包含各种字符。跳转到某条消息时用的是
`data-mid` 属性 + 遍历比较（见 `MessageList.tsx` 的 `jumpTo`），
不要用 `getElementById` 或拼 `[id="..."]` 选择器。

### ⚠️ 旧版 `title` 指令的行为变化

旧代码把 `["title", groupId, newName]` 里的 `"title"` 当成了会话名（bug）。
新版用的是第三个元素。如果后端依赖旧行为，改 `store/chat.ts` 的 `ingest()`。

### ⚠️ 回显对账的 pending 表不能随便清

`src/store/chat.ts` 里 `pending[echo]` 在超时后只是标记 `settled`，**不清除**。
清除的话，一个迟到很久的回显就会被当成新消息，多出一个重复气泡。
只有在「清空会话记录」这类明确语义下才需要连带清理。

### ⚠️ `backdrop-filter` 不要手写 `-webkit-` 前缀

同时写标准属性和前缀版时，Vite 的 CSS 压缩（Lightning CSS）会把**标准属性删掉**，
只留 `-webkit-backdrop-filter`，导致 Firefox 完全没有毛玻璃效果。
只写标准属性，前缀交给构建工具自动补。

### ⚠️ 不要在 PowerShell 里用 Get-Content/Set-Content 改源码

本项目源码是 UTF-8，其中大量中文注释与文案。
`Get-Content -Raw` + `Set-Content` 在某些环境下会按系统 ANSI 代码页解码，
把中文写成乱码，而且**边界字符会永久丢失**（不可逆）。
改文件请用编辑工具，或至少显式指定编码：

```powershell
# 如果非要用 PowerShell，必须显式给编码
[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
```

### ⚠️ 圆角一律用 `--r-*` 变量

组件里写 `rounded-[6px]` 这类硬编码值，「界面风格：直角/圆润」开关就管不到它。
统一写 `rounded-[var(--r-xs)]`（小徽标、小按钮）或 `rounded-[var(--r-md)]`（面板）。
头像、状态圆点、开关滑块这些**本来就该是圆的**元素继续用 `rounded-full`。

---

## 4. 性能备忘

- 切换主题 **不触发重渲染**（只改 DOM 属性 + CSS 变量）
- 切换会话是瞬时的（历史只在首次打开时读盘）
- `MessageItem` 用 `memo` 包了，列表滚动时不会整体重渲染
- 生产构建自动分包：`vendor` / `vendor-markdown` / `index`
- 图片用 `loading="lazy"`

如果会话消息量真的很大（上千条），下一步可以考虑虚拟滚动
（`react-window` 之类），但需要同时处理搜索高亮和跳转定位，改动面不小。

---

## 5. 类型检查与构建

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + vite build
```

`tsconfig.json` 开着几个比较严格的选项，改代码时注意：

- `verbatimModuleSyntax` —— 只做类型使用的 import 必须写 `import type`
- `noUnusedLocals` / `noUnusedParameters` —— 用不到的就删掉，别留着
- `erasableSyntaxOnly` —— 不能用 `enum`、构造函数参数属性等需要编译期转换的语法

---

## 6. 部署

```bash
npm run build
```

产物在 `dist/`，纯静态文件。

> 旧版本的 `build.outDir` 指向 `../clovers_client/console/page`。
> 现在的配置改成了 `dist`（更通用，也不会写到工作区外面）。
> 要恢复原来的行为，改 `vite.config.ts`：

```ts
build: {
    outDir: '../clovers_client/console/page',
    emptyOutDir: true,
}
```

### 服务器要求

前端本身不需要特殊配置，但**必须**由能提供以下接口的服务托管：

| 路径 | 说明 |
| --- | --- |
| `GET /` | 返回 `index.html` |
| `WS /ws` | WebSocket 升级 |
| `POST /upload` | multipart，字段名 `file` |
| `GET /download/{name}` | 返回文件；带 `?check=true` 时只探测是否存在 |
| `GET /message/{message_id}` | 可选，返回单条消息 JSON（用于补全引用内容） |
| 消息字段 `echo` | 可选，客户端发来的 `echo` 请原样带回广播里 |

最后两项是新增的**可选**能力，不实现也能正常用，只是会降级：

| 后端能力 | 不实现时的表现 |
| --- | --- |
| `echo` 原样回传 | 退化为按「发送者 + 文本/图片/回复/@列表」内容匹配本地占位气泡，绝大多数情况仍然不会重复；只有在多台设备同时发出**完全相同**的消息时才可能错位 |
| `GET /message/{id}` | 引用卡片在本地找不到该消息时显示「原消息已删除」 |

因为是单页应用，如果将来加了路由，需要把未匹配的路径回退到 `index.html`。
目前只有根路径，不需要额外配置。

### 缓存建议

`dist/assets/` 下的文件名带内容哈希，可以设置长期强缓存；
`index.html` 请设置 `no-cache`，否则更新后用户拿不到新版本。

---

## 7. 目录速查

```
src/
├─ App.tsx                  应用骨架
├─ types/protocol.ts        协议 + 本地模型
├─ styles/
│  ├─ index.css             Tailwind 入口、语义类、动画
│  ├─ themes.css            ★ 设计令牌（改主题来这里）
│  ├─ markdown.css          消息内 Markdown 排版
│  └─ highlight.css         代码高亮配色
├─ lib/                     纯函数工具
├─ services/                WebSocket / IndexedDB / 旧数据迁移
├─ store/                   zustand 状态
├─ hooks/                   可复用 Hook
└─ components/
   ├─ ui/                   通用控件
   ├─ layout/               侧栏与标题栏
   ├─ chat/                 消息列表与输入框
   └─ overlays/             各类浮层
```

---

## 8. 还没做、但可能需要的东西

按价值排序，供后续排期参考：

1. **虚拟滚动** —— 会话消息上千条时的性能
2. **消息编辑 / 撤回** —— 需要后端配合
3. **表情回应（reaction）** —— 需要协议扩展
4. **多标签页同步** —— 用 `BroadcastChannel` 同步 localStorage 与 IndexedDB 变更
5. **发送中队列的可见管理** —— 目前只有 Toast 提示，没有「待发队列」面板
6. **i18n** —— 目前文案是硬编码中文，抽出来即可
