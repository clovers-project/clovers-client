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
const atBtn = document.getElementById("atBtn") as HTMLButtonElement;
const mentionStatusArea = document.getElementById('mentionStatusArea') as HTMLDivElement;

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
    chatManager.pendingImages.splice(index, 1);
    // 重新渲染预览区
    imagePreviewArea.innerHTML = "";
    if (chatManager.pendingImages.length > 0) {
        chatManager.pendingImages.forEach((file, newIndex) => renderImagePreview(file, newIndex));
    } else {
        imagePreviewArea.classList.remove("active");
    }
}

const updateMentionUI = () => {
    mentionStatusArea.innerHTML = '';
    if (chatManager.replay) {
        const tag = document.createElement('div');
        tag.className = 'status-tag reply';
        tag.innerHTML = `<span>回复消息: ${chatManager.replay}</span>`;
        const btn = document.createElement('span');
        btn.className = 'close-btn';
        btn.innerHTML = '×';
        tag.appendChild(btn);
        btn.onclick = () => {
            chatManager.replay = null;
            tag.remove();
        };
        mentionStatusArea.appendChild(tag);
    }
    chatManager.at_list.forEach((userId) => {
        const userName = chatManager.UserStubs.get(userId) || userId;
        const tag = document.createElement('div');
        tag.className = 'status-tag';
        tag.innerHTML = `<span>@ ${userName}</span>`;
        const btn = document.createElement('span');
        btn.className = 'close-btn';
        btn.innerHTML = '×';
        tag.appendChild(btn);
        btn.onclick = () => {
            const index = chatManager.at_list.indexOf(userId);
            if (index !== -1) { chatManager.at_list.splice(index, 1) }
            updateMentionUI();
        };
        mentionStatusArea.appendChild(tag);
    });
};

function showContextMenu(x: number, y: number, message: HTMLDivElement) {
    const oldMenu = document.querySelector(".context-menu");
    if (oldMenu) oldMenu.remove();
    const menu = document.createElement("div");
    menu.className = "context-menu";
    const senderId = message.dataset.senderId!;
    const userName = chatManager.UserStubs.get(senderId) || senderId;
    const options = [
        {
            label: `@ ${userName}`, action: () => {
                if (chatManager.at_list.includes(senderId)) return;
                chatManager.at_list.push(senderId);
                updateMentionUI();
                messageInput.focus();
            }
        },
        {
            label: "回复", action: () => {
                chatManager.replay = message.id;
                if (!chatManager.at_list.includes(senderId)) chatManager.at_list.push(senderId);
                updateMentionUI();
                messageInput.focus();
            }
        },
        {
            label: "删除", action: () => {
                message.remove();
                const groupId = message.dataset.groupId;
                if (!groupId) return;
                chatHistoryStorage.delete(groupId).then(() => { chatHistoryStorage.append(groupId, chatWindow.innerHTML); })
            }
        },
    ];
    const closeMenu = (e: MouseEvent) => {
        if (menu.contains(e.target as Node)) return;
        menu.remove();
        document.removeEventListener("mousedown", closeMenu);
    };
    options.forEach(opt => {
        const item = document.createElement("div");
        item.className = "menu-item";
        item.textContent = opt.label;
        item.onclick = (e) => {
            e.stopPropagation();
            opt.action();
            menu.remove();
            document.removeEventListener("mousedown", closeMenu);
        };
        menu.appendChild(item);
    });
    document.body.appendChild(menu);
    menu.style.left = `${x + menu.offsetWidth > window.innerWidth ? x - menu.offsetWidth : x}px`;
    menu.style.top = `${y + menu.offsetHeight > window.innerHeight ? y - menu.offsetHeight : y}px`;
    menu.style.visibility = "visible"; // 计算完位置后再显示
    menu.classList.add("show");
    document.addEventListener("mousedown", closeMenu);
}

function createReplyMessage(messageId: string) {
    const message = document.createElement("div");
    message.className = "quote-message";
    message.dataset.refId = messageId;
    const replyMessage = document.getElementById(messageId);
    const quoteSender = document.createElement("div");
    quoteSender.className = "quote-sender";
    const quoteText = document.createElement("div");
    quoteText.className = "quote-text";
    if (replyMessage) {
        message.onclick = () => {
            replyMessage.scrollIntoView({ behavior: "smooth", block: "center" });
        };
        quoteSender.textContent = replyMessage.querySelector(".username")?.textContent || "未知用户";
        const rawText = replyMessage.querySelector(".message-content")?.textContent;
        if (rawText) {
            const index = rawText.indexOf("\n");
            quoteText.textContent = index !== -1 ? rawText.substring(0, index) : rawText;
        } else {
            quoteText.textContent = "无法显示消息内容";
        }
    } else {
        quoteSender.textContent = "未知用户";
        quoteText.textContent = "引用的消息已被删除";
    }
    message.appendChild(quoteSender);
    message.appendChild(quoteText);
    return message;
}

export async function chatMessage(msg: ChatMessage, is_self: boolean = false) {
    chatManager.UserStubs.set(msg.senderId, msg.senderName);
    chatManager.GroupStubs.set(msg.groupId, msg.groupName);
    const message = document.createElement("div");
    message.id = msg.messageId!;
    message.className = "message";
    message.dataset.senderId = msg.senderId;
    message.dataset.groupId = msg.groupId;
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
        const at = msg.at.map(id => `@${chatManager.UserStubs.get(id) || id} `).join("");
        content.innerHTML = await marked.parse(at + msg.text.trim(), { renderer });
    }
    // 回复消息
    if (msg.reply) {
        content.prepend(createReplyMessage(msg.reply));
    }
    // 图片内容
    if (msg.images.length > 0) {
        msg.images.forEach((imgUrl) => {
            const img = document.createElement("img");
            img.className = "message-image-item";
            img.src = imgUrl;
            img.alt = "聊天图片";
            img.loading = "lazy";
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


class ChatManager {
    public readonly pendingImages: File[]
    public readonly at_list: string[]
    public readonly UserStubs: Map<string, string>;
    public readonly GroupStubs: Map<string, string>;
    public atbot: boolean
    public replay: string | null
    constructor() {
        this.pendingImages = [];
        this.at_list = [];
        this.atbot = false;
        this.replay = null;
        this.UserStubs = new Map();
        this.GroupStubs = new Map();
    }
    public switchAt = () => {
        if (this.atbot) {
            this.atbot = false;
            atBtn.classList.remove("active");
            localStorage.setItem("atbot", "false");
        } else {
            this.atbot = true;
            atBtn.classList.add("active");
            localStorage.setItem("atbot", "true");
        }
        messageInput.focus();

    };
    public clear() {
        this.pendingImages.length = 0;
        this.at_list.length = 0;
        this.replay = null;
    }
}
const chatManager = new ChatManager();

atBtn.onclick = chatManager.switchAt;

async function sendMessage(manager: CloversManager) {
    const text = messageInput.value.trim();
    const images = chatManager.pendingImages.length === 0 ? [] : await manager.client.uploadFile(chatManager.pendingImages);
    const at = [...chatManager.at_list]
    if (!text && images.length === 0 && at.length === 0) return;
    // if (manager.currentGroup.flag) {
    //     manager.currentGroup.flag = false;
    //     manager.send(`\x05\x03\x01title ${text.length > 60 ? text.substring(0, 60) + "..." : text}`);
    // }
    messageInput.value = "";
    imageUpload.value = "";
    imagePreviewArea.innerHTML = "";
    imagePreviewArea.classList.remove("active");
    messageInput.focus();
    if (chatManager.atbot) { at.push("") }
    manager.send(text, images, at, chatManager.replay);
    chatManager.clear();
    updateMentionUI();
}

imageUpload.onchange = (event: Event) => {
    const files = (event.target as HTMLInputElement).files;
    if (files === null) return;
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
            chatManager.pendingImages.push(files[i]);
        }
    }
    imagePreviewArea.innerHTML = "";
    chatManager.pendingImages.forEach((file, index) => renderImagePreview(file, index));
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
        chatWindow.appendChild(systemMessage("聊天记录已清空"));
    };
    chatManager.atbot = localStorage.getItem("atbot") === "true";
    if (chatManager.atbot) atBtn.classList.add("active");
    chatWindow.oncontextmenu = (e) => {
        const target = e.target as HTMLElement;
        const message = target.closest(".message") as HTMLDivElement;
        if (!message) return;
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, message);

    };
    chatWindow.onclick = (e) => {
        const target = e.target as HTMLElement;
        let refId;
        let quoteMessage;
        if (target.classList.contains("message-image-item")) {
            const imgUrl = (target as HTMLImageElement).src;
            const backdrop = document.createElement("div");
            backdrop.className = "backdrop";
            backdrop.onclick = () => backdrop.remove();
            backdrop.innerHTML = `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%;">`;
            document.body.appendChild(backdrop);
        } else if (
            (refId = (target.closest(".quote-message") as HTMLElement)?.dataset?.refId) &&
            (quoteMessage = document.getElementById(refId))) {
            quoteMessage.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };
}


