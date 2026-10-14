/*
 * 文档截图生成脚本（一次性工具，不参与构建）
 *
 * 用法：先 npm run build && npm run serve，另开终端执行
 *   node scripts/capture-screenshots.mjs [baseUrl]
 * 默认 baseUrl = http://127.0.0.1:4173
 *
 * 做法：把 dist/index.html 复制成几张「预设了不同外观」的临时页面，
 * 再用 headless Chrome 逐个截图，最后删掉临时页面。
 * 需要本机有 Chrome 或 Edge。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'docs', 'screenshots');
const TMP = join(ROOT, '.tmp', 'shots');
const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';

const CHROME_CANDIDATES = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
    console.error('找不到 Chrome / Edge，请手动指定浏览器路径');
    process.exit(1);
}

if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/index.html 不存在，请先执行 npm run build');
    process.exit(1);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const baseHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const created = [];

/** 生成一张「预设外观」的临时页面 */
function makePage(name, config, extraHead = '') {
    const json = JSON.stringify(config).replace(/'/g, "\\'");
    const inject =
        `<script>try{localStorage.setItem('clovers.appearance','${json}');}catch(e){}</script>` + extraHead;
    const file = `__shot-${name}.html`;
    writeFileSync(
        join(DIST, file),
        baseHtml.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />${inject}`),
        'utf8',
    );
    created.push(join(DIST, file));
    return `${BASE}/${file}`;
}

function shot(name, url, width, height, budget = 12000) {
    const out = join(OUT, name);
    // 每次都用全新的 profile：否则上一轮留下的 IndexedDB 会累积演示消息
    const profile = join(TMP, name.replace(/\.png$/, ''));
    rmSync(profile, { recursive: true, force: true });
    execFileSync(
        chrome,
        [
            '--headless=new',
            '--disable-gpu',
            '--no-sandbox',
            '--hide-scrollbars',
            '--no-first-run',
            '--no-default-browser-check',
            `--user-data-dir=${profile}`,
            `--window-size=${width},${height}`,
            `--virtual-time-budget=${budget}`,
            `--screenshot=${out}`,
            url,
        ],
        { stdio: 'ignore' },
    );
    rmSync(profile, { recursive: true, force: true });
    console.log(`  ✓ ${name}`);
}

const appearance = (mode, palette, overrides = {}) => ({
    mode,
    palette,
    corner: 'square',
    density: 'comfortable',
    fontSize: 15,
    glass: true,
    autoHue: 268,
    background: { enabled: false, blur: 12, dim: 0.32, panelAlpha: 0.72, autoTheme: true },
    ...overrides,
});

/** 按快捷键打开浮层的注入脚本 */
const hotkey = (key) =>
    `<script>setTimeout(function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'${key}',ctrlKey:true,bubbles:true,cancelable:true}));},1800);</script>`;

const MODAL_APPEARANCE = `{mode:"light",palette:"ocean",corner:"square",density:"comfortable",fontSize:15,glass:true,autoHue:268,background:{enabled:false,blur:12,dim:0.32,panelAlpha:0.72,autoTheme:true}}`;

console.log(`使用浏览器：${chrome}\n开始截图 -> ${OUT}`);

try {
    shot('dark.png', makePage('dark', appearance('dark', 'indigo')), 1600, 1000);
    shot('light.png', makePage('light', appearance('light', 'ocean')), 1600, 1000);
    shot('command-palette.png', makePage('cmd', appearance('dark', 'indigo'), hotkey('k')), 1600, 1000);
    shot('settings.png', makePage('set', appearance('light', 'ocean'), hotkey(',')), 1600, 1000);
    shot('shortcuts.png', makePage('key', appearance('dark', 'indigo'), hotkey('/')), 1360, 900);

    // 移动端：用 iframe 拿到真实的 390px 视口（Chrome headless 的窗口有最小宽度）
    const mobileFrame = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0b0b0f;font-family:'Segoe UI',system-ui,sans-serif}
.wrap{display:flex;gap:26px;justify-content:center;align-items:center;height:100%}
figure{margin:0;text-align:center}
figcaption{color:#98a2b3;font-size:12px;margin-bottom:8px}
iframe{width:390px;height:748px;border:0;border-radius:18px;background:#fff;box-shadow:0 20px 50px -20px #000}
</style></head><body><div class="wrap">
<figure><figcaption>390 × 748 · 亮色 / 海蓝</figcaption><iframe src="/__shot-light.html"></iframe></figure>
<figure><figcaption>390 × 748 · 暗色 / 靛蓝</figcaption><iframe src="/__shot-dark.html"></iframe></figure>
</div></body></html>`;
    writeFileSync(join(DIST, '__shot-frame.html'), mobileFrame, 'utf8');
    created.push(join(DIST, '__shot-frame.html'));
    shot('mobile.png', `${BASE}/__shot-frame.html`, 900, 800, 16000);

    // 主题色板：直接渲染设计令牌，比截应用界面更直观
    const cssFile = readFileSync(join(DIST, 'index.html'), 'utf8').match(
        /href="(\/assets\/index-[^"]+\.css)"/,
    )[1];
    const palettes = [
        ['indigo', 'dark', '靛蓝'],
        ['ocean', 'light', '海蓝'],
        ['mint', 'dark', '薄荷'],
        ['forest', 'light', '森绿'],
        ['amber', 'light', '琥珀'],
        ['rose', 'light', '玫红'],
        ['violet', 'dark', '紫罗兰'],
        ['graphite', 'dark', '石墨'],
    ];
    const cells = palettes
        .map(
            ([id, mode, name]) => `<figure class="card" data-mode="${mode}" data-palette="${id}">
<figcaption><b>${name}</b><span>${mode === 'dark' ? '暗色' : '亮色'}</span></figcaption>
<div class="sw"><i style="background:var(--c-accent)"></i><i style="background:var(--c-surface)"></i><i style="background:var(--c-surface-2)"></i><i style="background:var(--c-bubble-in)"></i><i style="background:var(--c-bubble-out)"></i></div>
<div class="mock" style="background:var(--c-surface)"><div class="line"><span class="av" style="background:var(--c-accent)"></span><span class="bub" style="background:var(--c-bubble-in);color:var(--c-bubble-in-fg)">收到的消息</span></div><div class="line r"><span class="bub" style="background:var(--c-bubble-out);color:var(--c-bubble-out-fg)">发出的消息</span></div><div class="line r"><span class="pill" style="background:var(--c-accent);color:var(--c-accent-fg)">发送</span></div></div></figure>`,
        )
        .join('');
    writeFileSync(
        join(DIST, '__shot-palette.html'),
        `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${cssFile}"><style>
html,body{margin:0;background:#0b0b0f;font-family:'Segoe UI',system-ui,sans-serif;padding:16px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.card{margin:0;border:1px solid #ffffff1a;overflow:hidden}
figcaption{display:flex;justify-content:space-between;align-items:center;padding:9px 13px;font-size:13px;color:#e6e8ee;background:#16161c}
figcaption span{font-size:11px;color:#8b93a7}
.sw{display:flex;height:30px}.sw i{flex:1}
.mock{padding:12px 13px 14px;display:flex;flex-direction:column;gap:8px}
.line{display:flex;align-items:center;gap:8px}.line.r{justify-content:flex-end}
.av{width:20px;height:20px;border-radius:50%;flex:none}
.bub{font-size:12px;padding:5px 9px;white-space:nowrap}
.pill{font-size:12px;padding:5px 13px;font-weight:600}
</style></head><body><div class="grid">${cells}</div></body></html>`,
        'utf8',
    );
    created.push(join(DIST, '__shot-palette.html'));
    shot('themes.png', `${BASE}/__shot-palette.html`, 1500, 560, 5000);
} finally {
    created.forEach((file) => rmSync(file, { force: true }));
    console.log('\n完成，临时页面已清理');
}
