import type { ChatMessage, ConsoleMessage } from "./types";
import { sideBarTitle } from "./sidebar";
import { setItem } from "./tools";
import SparkMD5 from "spark-md5";

async function getFileMd5Name(file: File) {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    let currentChunk = 0;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    try {
        const loadNext = (): Promise<ArrayBuffer> => {
            return new Promise((resolve, reject) => {
                fileReader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
                fileReader.onerror = () => reject("File reading failed");
                const start = currentChunk * CHUNK_SIZE;
                const end = start + CHUNK_SIZE >= file.size ? file.size : start + CHUNK_SIZE;
                fileReader.readAsArrayBuffer(file.slice(start, end));
            });
        };
        while (currentChunk < totalChunks) {
            const buffer = await loadNext();
            spark.append(buffer);
            currentChunk++;
        }
        return spark.end();
    } catch (error) {
        return null;
    }
}

export class WebSocketClient {
    private socket: WebSocket | null = null;
    private retryAttempts = 0;
    private maxRethisDelay = 5000; // 最大重连间隔 5s
    private messageQueue: ChatMessage[] | ConsoleMessage[] = [];
    private receiveHandle: (message: ChatMessage | ConsoleMessage) => void;
    private ws_url: string;
    private upload_url: string;
    private download_url: string;
    constructor(receiveHandle: (message: ChatMessage | ConsoleMessage) => void) {
        this.ws_url = `ws://localhost:11000/ws`;
        this.upload_url = `/upload`;
        this.download_url = `/download`;
        this.receiveHandle = receiveHandle;
    }

    public async uploadFile(files: File[]) {
        const uploadPromises = files.map(async (file) => {
            const filename = await getFileMd5Name(file);
            if (!filename) return null;
            const url = `${this.download_url}/${filename}`;
            if ((await fetch(`${url}?check=true`, { method: "GET" })).status === 200) return url;
            const formData = new FormData();
            formData.append("file", file);
            if ((await fetch(this.upload_url, { method: "POST", body: formData })).status === 200) return url;
        });
        const results = await Promise.all(uploadPromises);
        return results.filter((url): url is string => url !== null);
    }

    public connect(): void {
        this.socket = new WebSocket(this.ws_url);
        setItem(sideBarTitle, null, "busy", null, "正在连接 Clovers 终端...");
        this.socket.onopen = () => {
            setItem(sideBarTitle, null, "online", null, "已连接到 Clovers 终端");
            this.retryAttempts = 0;
            if (this.messageQueue.length == 0) return;
            for (const message of this.messageQueue) {
                this.socket!.send(JSON.stringify(message));
            }
            this.messageQueue.length = 0;
        };
        this.socket.onmessage = (event) => {
            console.log("Received message:", event.data);
            try {
                const message: ChatMessage | ConsoleMessage = JSON.parse(event.data);
                this.receiveHandle(message);
            } catch (e) {
                console.error("Error parsing incoming message:", e, event.data);
            }
        };
        this.socket.onclose = () => {
            this.reconnect();
        };
        this.socket.onerror = (event) => {
            console.error("WebSocket Error:", event);
        };
    }
    public reconnect(): void {
        if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
        const delay = Math.min(this.retryAttempts * 500, this.maxRethisDelay);
        this.retryAttempts++;
        setTimeout(() => {
            this.connect();
        }, delay);
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
