# 主题系统说明

![主题色板](screenshots/themes.png)

## 核心思路

**组件里不写任何颜色。** 所有颜色来自 `src/styles/themes.css` 里的 CSS 变量，
变量通过 Tailwind 的 `@theme` 暴露成语义化的工具类（`bg-surface`、`text-muted`…），
所以切换主题只需要改 `<html>` 上的两个属性，**不触发任何 React 重渲染**。

```
settings store  ──写入──▶  <html data-mode="dark" data-palette="mint"
                                  data-corner="square" data-density="comfortable"
                                  data-glass="on" data-bg="off">
                                          │
                                          ▼
                            themes.css 里的 CSS 变量重新取值
                                          │
                                          ▼
                            所有 bg-surface / text-fg 自动跟着变
```

---

## 三层变量结构

### 第一层：调色板（只管色相和彩度）

```css
[data-palette='mint'] {
  --accent-h: 168;   /* 色相 */
  --accent-c: 0.14;  /* 彩度 */
}
```

`[data-palette='auto']` 是特殊值：它只给彩度，色相由 JS 写到 `<html>`
的行内样式上（来自背景图取色）。

### 第二层：明暗模式（定中性色的明度，并用色相给它染色）

```css
[data-mode='dark'] {
  --c-surface: oklch(0.196 0.013 var(--accent-h));   /* 极低彩度 + 主题色相 */
  --accent-l: 0.745;
  --c-accent: oklch(var(--accent-l) var(--accent-c) var(--accent-h));
  ...
}
```

这就是「换主题色以后整个界面色调都变了」的原因 —— 灰色里混了主题色的色相。

### 第三层：修饰开关

| 属性 / 变量 | 取值 | 作用 |
| --- | --- | --- |
| `data-corner` | `square` / `round` | 直角（Win10 扁平，默认）还是圆角卡片 |
| `data-density` | `comfortable` / `compact` | 留白与列表行高 |
| `data-glass` | `on` / `off` | 毛玻璃总开关 |
| `data-bg` | `on` / `off` | 是否有自定义背景图；开启后各层表面变成半透明亚克力色 |
| `--panel-alpha` | 0.25–1 | 面板不透明度（行内变量，背景图开启时生效） |

圆角相关的一切都走 `--r-*` 变量，**不要**在组件里写死像素值 ——
写死的话「直角/圆润」开关就管不到它了。

---

## 变量速查

| 变量 | 用途 |
| --- | --- |
| `--c-app` | 最外层页面底色（应用外壳之外） |
| `--c-surface` | 主面板（聊天区） |
| `--c-surface-2` | 次级面板（侧栏、输入框、卡片） |
| `--c-elevated` | 浮起来的表面（弹窗、下拉菜单） |
| `--c-hover` / `--c-active` | 悬浮 / 按下态背景 |
| `--c-line` / `--c-line-soft` / `--c-line-strong` | 三级边框 |
| `--c-fg` / `--c-fg-muted` / `--c-fg-subtle` | 三级文字 |
| `--c-accent` | 强调色（按钮、链接、焦点环） |
| `--c-accent-fg` | 放在强调色上的文字 |
| `--c-accent-soft` | 强调色的浅底（选中态、标签） |
| `--c-bubble-in` / `--c-bubble-out` | 收到 / 发出的消息气泡 |
| `--c-danger` / `--c-success` / `--c-warning` | 语义色 |
| `--c-glass` / `--c-overlay` | 毛玻璃面板 / 遮罩 |
| `--shadow-sm/md/lg` | 三级阴影 |
| `--r-xs…xl` | 圆角（前缀 `r-` 是为了不和 Tailwind 自带的 `--radius-*` 撞车） |
| `--pad-*` / `--gap-msg` / `--sidebar-w` | 密度相关的间距 |
| `--panel-alpha` | 背景图开启时的面板不透明度 |

对应可用的 Tailwind 类：`bg-surface`、`text-muted`、`border-line`、
`bg-accentsoft`、`text-accentfg`、`bg-bubbleout` …

---

## 加一套新的主题色（3 步）

1. 在 `src/styles/themes.css` 的调色板区加一段：

   ```css
   [data-palette='coral'] {
     --accent-h: 30;
     --accent-c: 0.16;
   }
   ```

2. 在 `src/store/settings.ts` 的 `PALETTES` 里加一条（`chroma` 要和 CSS 里的
   `--accent-c` 保持一致，否则设置面板里的色点会不准）：

   ```ts
   { id: 'coral', name: '珊瑚', hue: 30, chroma: 0.16 },
   ```

3. 在 `src/store/settings.ts` 的 `PaletteId` 联合类型里加上 `'coral'`。

完成。设置面板、命令面板会自动出现这一项 —— 它们都是遍历 `PALETTES` 渲染的。

---

## 加一个新的明暗模式？

一般不需要。现有的「亮色 / 暗色 / 跟随系统」已经覆盖了绝大多数场景。
真要加（比如「护眼绿」），在 `themes.css` 里复制一份 `[data-mode='dark']`
整块改成 `[data-mode='sepia']`，再改 `settings.ts` 的 `ThemeMode` 类型
和 `applyAppearance()` 就行。

---

## 首屏防闪烁

`index.html` 里有一段**内联脚本**，在 React 挂载之前就把持久化的外观写到
`<html>` 上。它和 `settings.ts` 的逻辑是重复的（没办法，内联脚本必须是零依赖的）。

**改动默认值时两边都要改**，否则会出现「打开瞬间是暗色，然后闪成亮色」。

```js
// index.html
var mode = s.mode || 'system';            // 默认值在这里
var root = document.documentElement;
root.dataset.mode = resolved;
root.dataset.palette = palette;
root.dataset.corner = s.corner || 'square';
root.dataset.density = s.density || 'comfortable';
root.dataset.glass = s.glass === false ? 'off' : 'on';
root.dataset.bg = bg.enabled ? 'on' : 'off';
```

另外注意：存储键是 `clovers.appearance`，和 `settings.ts` 里的 `KEYS.appearance`
必须一致。

---

## 毛玻璃开关

`data-glass="off"` 时：

- 覆盖 `--c-glass` / `--c-overlay` 为实色
- 强制所有 `.glass` 元素和 `.app-shell` 的 `backdrop-filter: none`

这样在低性能设备上关掉毛玻璃能明显减少合成开销。

---

## ⚠️ backdrop-filter 只写标准属性

写 CSS 时**只写** `backdrop-filter`，不要手写 `-webkit-backdrop-filter`：

```css
/* ✅ 对 */
.glass {
  backdrop-filter: blur(30px) saturate(170%);
}

/* ❌ 错：构建时 Lightning CSS 会把标准属性删掉，只留前缀版，
   Firefox 这类只认标准属性的浏览器就完全没有毛玻璃效果 */
.glass {
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
}
```

构建目标里需要的浏览器会自动被加上前缀，不需要手工维护。

---

## 自定义背景图的取色

「跟随背景图」时：

1. `store/background.ts` 用 `lib/imageColor.ts` 从图片里算出主色相
2. 结果写进 `settings.appearance.autoHue`
3. `applyAppearance()` 把它设成 `<html>` 的行内 `--accent-h`
4. `themes.css` 的 `[data-palette='auto']` 只提供彩度

想换一套取色策略，只改 `lib/imageColor.ts` 就行，其余部分不用动。

---

## 无障碍

- 全局遵守 `prefers-reduced-motion`：所有动画时长被压到 0.01ms
- `:focus-visible` 有统一的强调色焦点环；浮层容器用 `tabindex="-1"` 接焦点时
  不显示焦点环（避免一打开弹窗就看到一个突兀的框）
- `<meta name="color-scheme">` 会随模式更新，原生控件（滚动条、下拉框）跟着变
