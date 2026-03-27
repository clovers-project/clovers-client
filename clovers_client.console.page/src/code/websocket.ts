import type { ChatMessage, ConsoleMessage } from "./types";
import { sideBarTitle } from "./sidebar";
import { setItem } from "./tools";

export class WebSocketClient {
    private socket: WebSocket | null = null;
    private retryAttempts = 0;
    private maxRethisDelay = 5000; // 最大重连间隔 5s
    private messageQueue: ChatMessage[] | ConsoleMessage[] = []
    private receiveHandle: (message: ChatMessage | ConsoleMessage) => void;
    constructor(receiveHandle: (message: ChatMessage | ConsoleMessage) => void) {
        this.receiveHandle = receiveHandle;
    }
    public connect(): void {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url = `${protocol}//${window.location.host}/ws`;
        this.socket = new WebSocket(url);
        setItem(sideBarTitle, null, "busy", null, "正在连接 Clovers 终端...")
        this.socket.onopen = () => {
            setItem(sideBarTitle, null, "online", null, "已连接到 Clovers 终端")
            this.retryAttempts = 0;
            if (this.messageQueue.length == 0) return;
            for (const message of this.messageQueue) { this.socket!.send(JSON.stringify(message)); }
            this.messageQueue.length = 0;
        };
        this.socket.onmessage = (event) => {
            console.log("Received message:", event.data);
            try {
                const message: ChatMessage | ConsoleMessage = JSON.parse(event.data);
                this.receiveHandle(message);
            } catch (e) { console.error("Error parsing incoming message:", e, event.data); }
        };
        this.socket.onclose = () => { this.reconnect() };
        this.socket.onerror = (event) => { console.error("WebSocket Error:", event); };
    }
    public reconnect(): void {
        if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
        const delay = Math.min(this.retryAttempts * 500, this.maxRethisDelay);
        this.retryAttempts++;
        setTimeout(() => { this.connect(); }, delay);
    }
    public send(data: any) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.error("Socket not open. Message pushed to queue.");
            this.messageQueue.push(data);
        }
    }
}