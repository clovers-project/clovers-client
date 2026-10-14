/**
 * mock-server.mjs —— 零依赖的本地开发服务器
 *
 * 一次解决三件事：
 *   1. 静态托管 dist/（不需要 Vite / esbuild，任何环境都能跑）
 *   2. 实现 /upload 与 /download，让图片上传预览能跑通
 *   3. 实现最小可用的 WebSocket 服务（/ws），并按脚本推几条演示消息
 *
 * 用法：
 *   node scripts/mock-server.mjs            # 端口 4173
 *   node scripts/mock-server.mjs 8080       # 指定端口
 *   MOCK_INSTANT=1 node scripts/mock-server.mjs   # 演示消息立即推送（截图/自动化用）
 *
 * 说明：这不是生产服务器，只用于本地自测与演示；
 * 真实部署时 /ws、/upload、/download 由 Clovers 后端提供。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173);
/** 演示消息的推送延迟倍率，设为 0 表示立刻全部推送 */
const DELAY_SCALE = process.env.MOCK_INSTANT ? 0 : 1;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.map': 'application/json; charset=utf-8',
};

/* ------------------------------------------------------------------ */
/* 演示图片：动态生成 SVG，避免往仓库里塞二进制资源                    */
/* ------------------------------------------------------------------ */
function demoImage(label, hue) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hue} 85% 62%)"/>
    <stop offset="100%" stop-color="hsl(${(hue + 60) % 360} 80% 46%)"/>
  </linearGradient></defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <circle cx="120" cy="90" r="150" fill="rgba(255,255,255,.18)"/>
  <circle cx="540" cy="330" r="190" fill="rgba(0,0,0,.12)"/>
  <text x="50%" y="52%" text-anchor="middle" fill="#fff" font-size="46"
        font-family="Segoe UI, system-ui, sans-serif" font-weight="600">${label}</text>
</svg>`;
    return Buffer.from(svg, 'utf8');
}

const DEMO_IMAGES = new Map([
    ['demo-code.png', demoImage('代码截图', 250)],
    ['demo-ui.png', demoImage('界面预览', 165)],
]);

/* ------------------------------------------------------------------ */
/* 极简 WebSocket 服务端                                               */
/* ------------------------------------------------------------------ */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeFrame(payload) {
    const data = Buffer.from(payload, 'utf8');
    const len = data.length;
    let header;
    if (len < 126) {
        header = Buffer.from([0x81, len]);
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, data]);
}

/** 解析客户端发来的（必定带掩码的）帧，返回 { opcode, text } 或 null（数据还不完整） */
function decodeFrame(buffer) {
    if (buffer.length < 2) return null;
    const opcode = buffer[0] & 0x0f;
    const masked = (buffer[1] & 0x80) !== 0;
    let len = buffer[1] & 0x7f;
    let offset = 2;
    if (len === 126) {
        if (buffer.length < 4) return null;
        len = buffer.readUInt16BE(2);
        offset = 4;
    } else if (len === 127) {
        if (buffer.length < 10) return null;
        len = Number(buffer.readBigUInt64BE(2));
        offset = 10;
    }
    const maskLength = masked ? 4 : 0;
    if (buffer.length < offset + maskLength + len) return null;

    const mask = masked ? buffer.subarray(offset, offset + 4) : null;
    offset += maskLength;
    const payload = Buffer.from(buffer.subarray(offset, offset + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    return { opcode, text: payload.toString('utf8'), consumed: offset + len };
}

const demoSenders = [
    { senderId: 'assistant', senderName: '小叶子 BOT', permission: 'Admin', avatar: '' },
    { senderId: 'u-chen', senderName: '陈工', permission: 'Member', avatar: '' },
    { senderId: 'u-lin', senderName: '林同学', permission: 'Owner', avatar: '' },
];

function demoMessage(index, text, extra = {}) {
    const who = demoSenders[index % demoSenders.length];
    return {
        type: 'user',
        text,
        images: extra.images ?? [],
        at: extra.at ?? [],
        reply: extra.reply ?? null,
        groupId: extra.groupId ?? '1',
        groupName: extra.groupName ?? '默认会话',
        groupAvatar: '',
        ...who,
        messageId: randomUUID(),
        ...extra.override,
    };
}

function attachWebSocket(server) {
    server.on('upgrade', (req, socket) => {
        if (!req.url?.startsWith('/ws')) {
            socket.destroy();
            return;
        }
        const key = req.headers['sec-websocket-key'];
        const accept = createHash('sha1').update(key + GUID).digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
                'Upgrade: websocket\r\n' +
                'Connection: Upgrade\r\n' +
                `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
        );

        const send = (payload) => {
            if (socket.destroyed) return;
            socket.write(encodeFrame(JSON.stringify(payload)));
        };

        console.log('[ws] 客户端已连接');

        // 开场白：先来一条系统消息和一段带 Markdown / 代码块的自我介绍
        const timers = [];
        const later = (ms, fn) => timers.push(setTimeout(fn, ms * DELAY_SCALE));

        send({ type: 'system', data: ['log', '1', '已连接到演示服务器（mock）'] });

        later(400, () =>
            send(
                demoMessage(0, [
                    '## 欢迎使用 clovers 终端',
                    '',
                    '这是一段演示消息，用来展示重构后的排版：',
                    '',
                    '- **Markdown** 全量支持，代码块带语言标签与一键复制',
                    '- 多主题切换：按 `Ctrl/⌘ + K` 打开命令面板试试',
                    '- 会话内搜索：`Ctrl/⌘ + F`',
                    '',
                    '```ts',
                    'const theme = pick(["indigo", "mint", "rose"]);',
                    'applyTheme(theme); // 8 套主题色 × 明暗两档',
                    '```',
                    '',
                    '> 右键任意消息可以回复、@ 提及或删除。',
                ].join('\n')),
            ),
        );

        later(900, () =>
            send(
                demoMessage(1, '顺便试一下图片气泡和灯箱：点击可以缩放、拖拽、左右切换。', {
                    images: ['/download/demo-ui.png', '/download/demo-code.png'],
                }),
            ),
        );

        later(1500, () =>
            send(
                demoMessage(2, '收到 👌', {
                    at: ['assistant'],
                }),
            ),
        );

        later(2200, () =>
            send({
                type: 'system',
                data: ['log', '1', '以上为演示数据，发送消息会原样回显'],
            }),
        );

        let buffer = Buffer.alloc(0);
        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            let frame = decodeFrame(buffer);
            while (frame) {
                buffer = buffer.subarray(frame.consumed);
                if (frame.opcode === 0x8) {
                    socket.end();
                    return;
                }
                if (frame.opcode === 0x1) {
                    try {
                        const message = JSON.parse(frame.text);
                        respond(message, send);
                    } catch (err) {
                        console.warn('[ws] 无法解析客户端消息', err);
                    }
                }
                frame = decodeFrame(buffer);
            }
        });

        const cleanup = () => {
            timers.forEach(clearTimeout);
            console.log('[ws] 客户端已断开');
        };
        socket.on('close', cleanup);
        socket.on('error', cleanup);
    });
}

/**
 * 处理客户端发来的消息。
 *
 * 关键行为对齐真实后端：
 *   1. 把消息**原样广播回去**（广播版本会带上客户端给的 echo）——
 *      前端靠这个 echo 把手上的「发送中」占位气泡换成正式记录；
 *   2. 之后再让 BOT 补一条回复。
 */
function respond(message, send) {
    // 1) 广播回显：messageId 由服务端补上，其余字段保持原样
    const broadcast = {
        ...message,
        messageId: randomUUID(),
    };
    delete broadcast.echoPending;
    // 记录一下，供 GET /message/{id} 查询
    messageStore.set(broadcast.messageId, broadcast);
    setTimeout(() => send(broadcast), 90 * DELAY_SCALE);

    // 2) BOT 回复
    const reply = {
        type: 'user',
        text: '',
        images: [],
        at: [],
        reply: broadcast.messageId,
        senderId: 'assistant',
        senderName: '小叶子 BOT',
        permission: 'Admin',
        avatar: '',
        groupId: message.groupId,
        groupName: message.groupName,
        groupAvatar: '',
        messageId: randomUUID(),
    };

    if (message.text?.trim()) {
        const lower = message.text.toLowerCase();
        if (lower.includes('hello') || message.text.includes('你好')) {
            reply.text = '你好！我是演示用的回声 BOT，当前运行在 `scripts/mock-server.mjs`。';
        } else if (message.text.includes('代码')) {
            reply.text = [
                '给你一段示例代码：',
                '',
                '```python',
                'def greet(name: str) -> str:',
                '    return f"hi, {name}"',
                '```',
            ].join('\n');
        } else {
            reply.text = `收到：**${message.text}**`;
        }
    } else if (message.images?.length) {
        reply.text = `收到 ${message.images.length} 张图片，灯箱里可以放大查看。`;
    } else {
        reply.text = '收到你的 @ 提及。';
    }

    messageStore.set(reply.messageId, reply);
    setTimeout(() => send(reply), 420 * DELAY_SCALE);
}

/** 已广播过的消息，支持 GET /message/{id} 回溯查询 */
const messageStore = new Map();

/* ------------------------------------------------------------------ */
/* HTTP：静态文件 + 上传下载                                            */
/* ------------------------------------------------------------------ */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function serveStatic(req, res) {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const candidate = join(ROOT, normalize(pathname).replace(/^(\.\.[\\/])+/, ''));
    if (!candidate.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    try {
        const info = await stat(candidate);
        const file = info.isDirectory() ? join(candidate, 'index.html') : candidate;
        const body = await readFile(file);
        res.writeHead(200, {
            'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
            'Cache-Control': 'no-cache',
        });
        res.end(body);
    } catch {
        // SPA 回退
        try {
            const body = await readFile(join(ROOT, 'index.html'));
            res.writeHead(200, { 'Content-Type': MIME['.html'] });
            res.end(body);
        } catch {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('未找到 dist/，请先执行 npm run build');
        }
    }
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    // 上传：接收 multipart，直接回 200（内容不需要真的落盘）
    if (url.pathname === '/upload' && req.method === 'POST') {
        await readBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
    }

    // 下载 / 存在性探测
    if (url.pathname.startsWith('/download/')) {
        const name = decodeURIComponent(url.pathname.slice('/download/'.length));
        if (DEMO_IMAGES.has(name)) {
            const body = DEMO_IMAGES.get(name);
            res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Content-Length': body.length });
            res.end(body);
            return;
        }
        // ?check=true 用来判断服务端是否已存在该文件：这里一律当作不存在
        res.writeHead(url.searchParams.get('check') === 'true' ? 404 : 200);
        res.end();
        return;
    }

    // 调试用：把响应拖慢指定毫秒。
    // 用途：headless 截图/取 DOM 时用来把「加载完成」推迟到真实时间之后，
    // 因为 headless 是在 load 事件之后才截图的。
    //   /__delay?ms=4000        纯文本
    //   /__delay?ms=4000&img=1  1×1 透明 PNG（可当 <img> 用，拖住 load 事件）
    if (url.pathname === '/__delay') {
        const ms = Math.min(15000, Number(url.searchParams.get('ms')) || 1000);
        const asImage = url.searchParams.get('img') === '1';
        setTimeout(() => {
            if (asImage) {
                const png = Buffer.from(
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                    'base64',
                );
                res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
                res.end(png);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('ok');
        }, ms);
        return;
    }

    // 单条消息查询：GET /message/{message_id}
    if (url.pathname.startsWith('/message/')) {
        const id = decodeURIComponent(url.pathname.slice('/message/'.length));
        const found = messageStore.get(id);
        if (!found) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end('{"error":"not found"}');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(found));
        return;
    }

    await serveStatic(req, res);
});

attachWebSocket(server);

server.listen(PORT, () => {
    console.log(`\n  clovers 控制台演示服务器`);
    console.log(`  ▸ 静态目录 : ${ROOT}`);
    console.log(`  ▸ 访问地址 : http://localhost:${PORT}\n`);
    console.log(`  提示：先执行 npm run build 生成 dist/，或用 npm run dev 走 Vite 开发服务器。\n`);
});
