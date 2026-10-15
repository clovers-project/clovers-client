/**
 * client.ts —— 与 Clovers 终端后端的连接层。
 *
 * 职责边界：只负责「网络」，不碰 DOM、不碰 React。
 * 收到的消息通过 onMessage 回调交给上层（store/bridge.ts）处理。
 *
 * 接口约定：
 *   WS   /ws                             双向 JSON 消息
 *   POST /upload   multipart 字段名 file  上传文件（服务端按 MD5 命名）
 *   GET  /download/<name>?check=true      下载 / 上传前探测是否已存在
 *   GET  /message/<message_id>            按 ID 查询单条消息（用于补全引用内容）
 */
import type {
    ClientUserMessage,
    ConnectionState,
    ServerMessage,
    ServerUserMessage,
} from '@/types/protocol';
import { fileMd5 } from '@/lib/md5';

export interface ClientOptions {
    onMessage: (message: ServerMessage) => void;
    onStateChange: (state: ConnectionState) => void;
}

export class CloversClient {
    private socket: WebSocket | null = null;
    private queue: ClientUserMessage[] = [];
    private retry = 0;
    private timer: number | null = null;
    private manualClose = false;
    private readonly options: ClientOptions;

    private readonly wsUrl = '/ws';
    private readonly uploadUrl = '/upload';
    private readonly downloadUrl = '/download';
    private readonly messageMessageUrl = '/message';
    private readonly messageMessageHistoryUrl = '/message_history';
    private static readonly MAX_DELAY = 15000;

    constructor(options: ClientOptions) {
        this.options = options;
    }

    /* ------------------------------ 连接管理 ------------------------------ */

    connect(): void {
        this.manualClose = false;
        if (
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }
        this.options.onStateChange('connecting');

        let socket: WebSocket;
        try {
            socket = new WebSocket(this.wsUrl);
        } catch (err) {
            console.error('[ws] 创建连接失败', err);
            this.options.onStateChange('offline');
            this.scheduleRetry();
            return;
        }
        this.socket = socket;

        socket.onopen = () => {
            this.retry = 0;
            this.options.onStateChange('online');
            this.flushQueue();
        };

        socket.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data) as ServerMessage;
                this.options.onMessage(parsed);
            } catch (err) {
                console.error('[ws] 消息解析失败', err, event.data);
            }
        };

        socket.onerror = () => {
            // onerror 之后一定会触发 onclose，重连逻辑统一放在 onclose
            this.options.onStateChange('offline');
        };

        socket.onclose = () => {
            this.socket = null;
            this.options.onStateChange('offline');
            if (!this.manualClose) this.scheduleRetry();
        };
    }

    /** 用户手动点击「重连」时调用：跳过退避等待 */
    reconnectNow(): void {
        this.retry = 0;
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.socket) {
            this.manualClose = true;
            try {
                this.socket.close();
            } catch {
                /* ignore */
            }
            this.socket = null;
        }
        this.connect();
    }

    private scheduleRetry(): void {
        if (this.timer !== null) return;
        const delay = Math.min(500 * 2 ** Math.min(this.retry, 5), CloversClient.MAX_DELAY);
        this.retry += 1;
        this.timer = window.setTimeout(() => {
            this.timer = null;
            this.connect();
        }, delay);
    }

    private flushQueue(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        const pending = this.queue;
        this.queue = [];
        pending.forEach((message) => this.socket?.send(JSON.stringify(message)));
    }

    get isOnline(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    /* ------------------------------ 发送 ------------------------------ */

    send(message: ClientUserMessage): boolean {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return true;
        }
        // 离线时排队，连上后自动补发（与旧版行为一致）
        this.queue.push(message);
        return false;
    }

    /* ------------------------------ 文件上传 ------------------------------ */

    /**
     * 上传一批文件，返回可访问的 URL 列表。
     * 先按 MD5 探测服务端是否已有同名文件，命中则直接复用，避免重复传输。
     */
    async uploadFiles(files: File[]): Promise<string[]> {
        const results = await Promise.all(
            files.map(async (file) => {
                const digest = await fileMd5(file);
                if (!digest) return null;
                const url = `${this.downloadUrl}/${digest}`;
                try {
                    const probe = await fetch(`${url}?check=true`, { method: 'GET' });
                    if (probe.status === 200) return url;
                } catch {
                    /* 探测失败就当不存在，继续走上传 */
                }
                const form = new FormData();
                form.append('file', file);
                try {
                    const res = await fetch(this.uploadUrl, { method: 'POST', body: form });
                    return res.status === 200 ? url : null;
                } catch (err) {
                    console.error('[upload] 上传失败', err);
                    return null;
                }
            }),
        );
        return results.filter((url): url is string => url !== null);
    }

    /* ------------------------------ 单条消息查询 ------------------------------ */

    /**
     * 按 messageId 查询一条消息。
     * 用途：本地历史里没有这条消息时（比如换了设备、或引用的是很久以前的消息），
     * 仍然能把引用卡片的内容补全。
     */
    async fetchMessage(messageId: string): Promise<ServerUserMessage | null> {
        if (!messageId) return null;
        try {
            const res = await fetch(`${this.messageMessageUrl}/${encodeURIComponent(messageId)}`);
            if (res.status !== 200) return null;
            const message = (await res.json()) as ServerMessage;
            return message.type !== 'system' ? message : null;
        } catch (err) {
            console.error('[message] 查询失败', err);
            return null;
        }
    }

    async fetchMessageHistory(messageId: string): Promise<ServerMessage[] | null> {
        if (!messageId) return null;
        try {
            const res = await fetch(`${this.messageMessageHistoryUrl}/${encodeURIComponent(messageId)}`);
            if (res.status !== 200) return null;
            const data = (await res.json()) as string[];
            return data.map(payload => JSON.parse(payload) as ServerMessage);
        } catch (err) {
            console.error('[message_history] 查询失败', err);
            return null;
        }
    }
}