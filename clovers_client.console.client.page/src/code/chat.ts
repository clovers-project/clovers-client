import "./core"
import { currentUser, currentGroup } from "./core"

export const chatWindow = document.getElementById("chatWindow") as HTMLDivElement;
const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const imageUpload = document.getElementById("imageUpload") as HTMLInputElement;
const imagePreviewArea = document.getElementById("imagePreviewArea") as HTMLDivElement;
const cloversBtn = document.getElementById("cloversBtn") as HTMLButtonElement;

let currentMessageId = 0;
let pendingImages: File[] = [];
// let messageQueue: ChatMessage[] = [];
let messageQueue: ChatMessage | null = null; //决定 messageQueue 长度为 1
let connect: WebSocket | null = null;

function clearInput(): void {
    messageInput.value = "";
    pendingImages = [];
    imageUpload.value = ""; // 清除文件选择器的内容
    imagePreviewArea.innerHTML = "";
    imagePreviewArea.classList.remove("active");
}
function receiveAndDisplayMessage(message: ChatMessage): void {
    const messageElement = document.createElement("div");
    messageElement.className = "message";
    messageElement.dataset.id = message.id.toString();
    if (message.type === "system") {
        // 系统消息
        messageElement.classList.add("system");
        messageElement.innerHTML = `<p class="system-text">${message.text}</p>`;
    } else if (message.type === "user") {
        // 用户消息
        const isSelf = message.senderName === currentUser.userName;
        messageElement.classList.add(isSelf ? "self" : "other");
        // 用户名
        const sender = document.createElement("p");
        sender.className = "username";
        sender.textContent = message.senderName;
        // 消息内容气泡
        const content = document.createElement("div");
        content.className = "message-content";
        // 文本内容
        if (message.text) {
            const text = document.createElement("p");
            text.className = "message-text";
            text.textContent = message.text;
            content.appendChild(text);
        }
        // 图片内容
        if (message.images && message.images.length > 0) {
            message.images.forEach((imgUrl) => {
                const img = document.createElement("img");
                img.className = "message-image-item";
                img.src = imgUrl;
                img.alt = "聊天图片";
                img.loading = "lazy";
                // 添加点击查看大图的事件
                img.onclick = () => {
                    const backdrop = document.createElement("div");
                    backdrop.className = "backdrop";
                    backdrop.onclick = () => document.body.removeChild(backdrop);
                    backdrop.innerHTML = `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%;">`;
                    document.body.appendChild(backdrop);
                };
                content.appendChild(img);
            });
        }
        messageElement.appendChild(sender);
        messageElement.appendChild(content);
    }
    chatWindow.appendChild(messageElement);
    localStorage.setItem("lastMessage", JSON.stringify(message));
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

export function sendSystemMessage(text: string): void {
    receiveAndDisplayMessage({
        id: currentMessageId++,
        type: "system",
        senderId: "",
        senderName: "系统",
        text: text,
        timestamp: Date.now(),
    });
}

function websocketConnection(ws: WebSocket): void {
    function handleIncomingMessage(messageData: string): void {
        try {
            const message: ChatMessage = JSON.parse(messageData);
            if (!message.senderName || !message.text) {
                console.warn("Received malformed message:", message);
                return;
            }
            message.id = currentMessageId++;
            if (!message.timestamp) message.timestamp = Date.now();
            receiveAndDisplayMessage(message);
        } catch (e) {
            receiveAndDisplayMessage({
                id: currentMessageId++,
                type: "system",
                senderId: "",
                senderName: "server",
                text: messageData.length > 20 ? messageData.substring(0, 18) + "..." : messageData,
                timestamp: Date.now(),
            });
            console.error("Error parsing incoming message:", e, messageData);
        }
    }

    ws.onopen = (event) => {
        receiveAndDisplayMessage({
            id: currentMessageId++,
            type: "system",
            senderId: "",
            senderName: "系统",
            text: `连接成功！已连接到 ${ws.url}`,
            timestamp: Date.now(),
        });
        if (messageQueue != null) {
            ws.send(JSON.stringify(messageQueue));
            messageQueue = null;
        }
    };
    ws.onmessage = (event) => {
        console.log("Received message:", event.data);
        handleIncomingMessage(event.data);
    };
    ws.onclose = (event) => {
        let reason = event.reason || "服务器关闭";
        if (event.code !== 1000 && event.code !== 1005) {
            // 1000: 正常关闭
            reason = `连接异常关闭 (代码: ${event.code})`;
        }
        receiveAndDisplayMessage({
            id: currentMessageId++,
            type: "system",
            senderId: "",
            senderName: "系统",
            text: `连接已断开: ${reason}`,
            timestamp: Date.now(),
        });
    };
    ws.onerror = (event) => {
        console.error("WebSocket Error:", event);
    };
}

export function connectCloversServer(url: string): void {
    if (connect) {
        if (connect.url === url && connect.readyState === WebSocket.OPEN) return;
        connect.close(1000, "Changing server address");
        connect = null;
    }
    connect = new WebSocket(url);
    websocketConnection(connect);
}
function sendMessage(): void {
    const text = messageInput.value.trim();
    if (!text && pendingImages.length === 0) {
        return;
    }
    const imagePromises = pendingImages.map((file) => {
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
        });
    });
    Promise.all(imagePromises).then((imageUrls) => {
        const newMessage: ChatMessage = {
            id: currentMessageId++,
            type: "user",
            senderId: currentUser.userId,
            senderName: currentUser.userName,
            groupId: currentGroup.groupId,
            avatar: currentUser.avatar,
            groupAvatar: currentGroup.avatar,
            permission: currentUser.permission,
            text: text,
            images: imageUrls,
            timestamp: Date.now(),
        };
        receiveAndDisplayMessage(newMessage);
        clearInput();
        messageInput.focus();
        if (connect) {
            if (connect.readyState === WebSocket.OPEN) {
                connect.send(JSON.stringify(newMessage));
            } else {
                messageQueue = newMessage;
                connectCloversServer(connect.url);
            }
        } else {
            receiveAndDisplayMessage({
                id: currentMessageId++,
                type: "system",
                senderId: "",
                senderName: "系统",
                text: `未连接到 Clovers Client Console`,
                timestamp: Date.now(),
            });
        }
    });
}

sendBtn.addEventListener("click", sendMessage);

function renderImagePreview(file: File, index: number): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
        const item = document.createElement("div");
        item.className = "preview-item";
        const removeBtn = document.createElement("button");
        removeBtn.className = "delete-button";
        removeBtn.id = "deleteImageBtn";
        removeBtn.innerHTML = '×';
        removeBtn.title = "移除图片";
        removeBtn.onclick = () => removeImage(index);
        item.appendChild(removeBtn);
        const img = document.createElement("img");
        img.className = "preview-image";
        img.src = e.target?.result as string;
        item.appendChild(img);
        imagePreviewArea.appendChild(item);
    };
    reader.readAsDataURL(file);
}
function removeImage(index: number): void {
    pendingImages.splice(index, 1);
    // 重新渲染预览区
    imagePreviewArea.innerHTML = "";
    if (pendingImages.length > 0) {
        pendingImages.forEach((file, newIndex) => renderImagePreview(file, newIndex))
    } else {
        imagePreviewArea.classList.remove("active");
    }
}

imageUpload.addEventListener("change", (event: Event) => {
    const files = (event.target as HTMLInputElement).files;
    if (files === null) return;
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
            pendingImages.push(files[i]);
        }
    }
    imagePreviewArea.innerHTML = "";
    pendingImages.forEach((file, index) => renderImagePreview(file, index));
    imagePreviewArea.classList.add("active");

});

messageInput.addEventListener("keydown", (event: KeyboardEvent) => {
    // 检查是否按下了回车键 (Key: 'Enter', Code: 'Enter')
    if (event.key === "Enter") {
        if (!event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }
});

cloversBtn.addEventListener("click", () => {
    let url = prompt("请输入 clovers 服务器地址:", connect?.url || "ws://");
    if (url === null) {
        return;
    }
    url = url.trim();
    if (!url) {
        return;
    }
    if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
        alert("请使用 ws:// 或 wss:// 开头。");
        return;
    }
    localStorage.setItem("CloversClientConsoleUrl", url);
    connectCloversServer(url);
});
