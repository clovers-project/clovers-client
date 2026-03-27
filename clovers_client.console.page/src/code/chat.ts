import type { ChatMessage } from "./types";
import type { CloversManager } from "./core";
import { openDB } from "idb";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-light.css";

export const chatWindow = document.getElementById("chatWindow") as HTMLDivElement;
const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const imageUpload = document.getElementById("imageUpload") as HTMLInputElement;
const imagePreviewArea = document.getElementById("imagePreviewArea") as HTMLDivElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;

const dbPromise = openDB("ChatAppDB", 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains("histories")) {
            db.createObjectStore("histories");
        }
    },
});
export const chatHistoryStorage = {
    async append(groupId: string, html: string) {
        const db = await dbPromise;
        const records: string[] = (await db.get("histories", groupId)) || [];
        records.push(html);
        await db.put("histories", records, groupId);
    },
    async get(groupId: string): Promise<string> {
        const db = await dbPromise;
        const records = (await db.get("histories", groupId)) as string[] | undefined;
        if (!records || records.length === 0) return "";
        return records.join("\n");
    },
    async delete(groupId: string) {
        const db = await dbPromise;
        await db.delete("histories", groupId);
    },
    async clearAll() {
        const db = await dbPromise;
        await db.clear("histories");
    },
};

const renderer = new marked.Renderer();
marked.setOptions({ gfm: true });
marked.use({
    tokenizer: {
        del() {
            return undefined;
        },
    },
});
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const validLang = lang ? (hljs.getLanguage(lang) ? lang : "plaintext") : "plaintext";
    const highlighted = hljs.highlight(text, { language: validLang }).value;
    return (
        `<pre class="code-block" data-lang="${lang}">` +
        `<code>${highlighted}</code>` +
        `<span class="code-block-copy">点击复制代码</span>` +
        `</pre>`
    );
};

chatWindow.addEventListener("click", async (e) => {
    const target = e.target as Element;
    const btn = target.closest(".code-block-copy") as HTMLSpanElement;
    if (!btn) return;
    const codeElement = btn.parentElement?.querySelector("code") as HTMLElement;
    if (!codeElement) return;
    const codeText = codeElement.innerText;
    const originalText = btn.innerText;
    try {
        await navigator.clipboard.writeText(codeText);
        btn.innerText = "已复制";
    } catch (err) {
        console.error("复制失败:", err);
        btn.innerText = "复制失败";
    }
    setTimeout(() => {
        btn.innerText = originalText;
    }, 2000);
});

function renderImagePreview(file: File, index: number): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
        const item = document.createElement("div");
        item.className = "preview-item";
        const removeBtn = document.createElement("button");
        removeBtn.className = "delete-button";
        removeBtn.id = "deleteImageBtn";
        removeBtn.innerHTML = "×";
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
        pendingImages.forEach((file, newIndex) => renderImagePreview(file, newIndex));
    } else {
        imagePreviewArea.classList.remove("active");
    }
}

export async function chatMessage(msg: ChatMessage, is_self: boolean = false) {
    const message = document.createElement("div");
    message.className = "message";
    const messageElement = document.createElement("div");
    messageElement.className = "message-column";
    // 用户消息
    let avatar;
    if (msg.avatar) {
        avatar = document.createElement("img");
        avatar.src = msg.avatar;
    } else {
        avatar = document.createElement("div");
    }
    avatar.className = "avatar";
    if (is_self) {
        message.classList.add("self");
        message.appendChild(messageElement);
        message.appendChild(avatar);
    } else {
        message.classList.add("other");
        message.appendChild(avatar);
        message.appendChild(messageElement);
    }
    // 用户名
    const sender = document.createElement("p");
    sender.className = "username";
    sender.textContent = msg.senderName;
    // 消息内容气泡
    const content = document.createElement("div");
    content.className = "message-content";
    // 文本内容
    if (msg.text) {
        content.innerHTML = await marked.parse(msg.text.trim(), { renderer });
    }
    // 图片内容
    if (msg.images.length > 0) {
        msg.images.forEach((imgUrl) => {
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
    chatHistoryStorage.append(msg.groupId, message.outerHTML);
    return message;
}

export function systemMessage(text: string) {
    const message = document.createElement("div");
    message.className = "message";
    message.classList.add("system");
    message.innerHTML = `<p class="system-text">${text}</p>`;
    return message;
}

const pendingImages: File[] = [];
async function sendMessage(manager: CloversManager) {
    const text = messageInput.value.trim();
    if (!text && pendingImages.length === 0) return;
    // if (manager.currentGroup.flag) {
    //     manager.currentGroup.flag = false;
    //     manager.send(`\x05\x03\x01title ${text.length > 60 ? text.substring(0, 60) + "..." : text}`);
    // }
    const images = await Promise.all(
        pendingImages.map((file) => {
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });
        }),
    );
    manager.send(text, images);
    messageInput.value = "";
    pendingImages.length = 0;
    imageUpload.value = "";
    imagePreviewArea.innerHTML = "";
    imagePreviewArea.classList.remove("active");
    messageInput.focus();
}

imageUpload.onchange = (event: Event) => {
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
};

messageInput.oninput = () => {
    messageInput.style.height = "auto";
    messageInput.style.height = messageInput.scrollHeight + "px";
};
export function init(manager: CloversManager) {
    messageInput.onkeydown = (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
            messageInput.style.height = "auto";
            event.preventDefault();
            sendMessage(manager);
        }
    };

    sendBtn.onclick = () => {
        messageInput.style.height = "auto";
        sendMessage(manager);
    };

    clearBtn.onclick = () => {
        chatWindow.innerHTML = "";
        chatHistoryStorage.delete(manager.currentGroup.groupId);
        // manager.send(`\x05\x03\x01cleanup`);
        // manager.currentGroup.flag = true;
        manager.groupSave();
    };
}
