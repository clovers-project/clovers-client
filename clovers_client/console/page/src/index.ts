import './style.css';
// 定义消息类型接口
interface ChatMessage {
    id: number; // 消息唯一ID
    type: 'system' | 'user'; // 消息类型
    senderId: string; // 发送者ID (系统消息可为空)
    senderName: string; // 发送者用户名
    groupId?: string; // 群组ID (可选)
    avatar?: string;
    groupAvatar?: string;
    permission?: 'SuperUser' | 'Owner' | 'Admin' | 'Member';
    text: string; // 文本内容
    images?: string[]; // 图片URLs (base64或实际URL)
    timestamp: number;
}

// class User(BaseModel):
//     user_id: str = "0"
//     group_id: str = "0"
//     nickname: str = "Master"
//     avatar: str = "https://localhost:8080/avatar/0.png"
//     group_avatar: str = "https://localhost:8080/group_avatar/0.png"
//     permission: int = 3

interface UserInfo {
    userId: string;
    groupId: string;
    nickname: string;
    avatar: string;
    groupAvatar: string;
    permission: 'SuperUser' | 'Owner' | 'Admin' | 'Member';
}

// 全局状态
let currentUserInfo: UserInfo = {
    userId: '1048827424',
    groupId: '744751179',
    nickname: '文文',
    avatar: "https://q1.qlogo.cn/g?b=qq&nk=1048827424&s=640",
    groupAvatar: "https://p.qlogo.cn/gh/744751179/744751179/640",
    permission: 'SuperUser'
};
let currentCloversServer: string = 'ws://localhost:11000';
let ws: WebSocket | null = null;
let currentMessageId = 0;

// 获取DOM元素
const chatWindow = document.getElementById('chatWindow') as HTMLDivElement;
const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
const userinfoBtn = document.getElementById('userinfoBtn') as HTMLButtonElement;
const imageUpload = document.getElementById('imageUpload') as HTMLInputElement;
const cloversBtn = document.getElementById('cloversBtn') as HTMLButtonElement;
const imageUploadBtn = document.getElementById('imageUploadBtn') as HTMLButtonElement;
const imagePreviewArea = document.getElementById('imagePreviewArea') as HTMLDivElement;

let pendingImages: File[] = [];

function scrollToBottom(): void {
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function clearInput(): void {
    messageInput.value = '';
    pendingImages = [];
    imageUpload.value = ''; // 清除文件选择器的内容
    imagePreviewArea.innerHTML = '';
    imagePreviewArea.classList.remove('active');
}

function sendMessage(): void {
    const text = messageInput.value.trim();
    if (!text && pendingImages.length === 0) {
        // alert('不能发送空消息！'); // 避免在回车时频繁弹出
        return;
    }

    const imagePromises = pendingImages.map(file => {
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file); // 转换为 base64
        });
    });

    Promise.all(imagePromises).then(imageUrls => {
        const newMessage: ChatMessage = {
            id: currentMessageId++,
            type: 'user',
            senderId: currentUserInfo.userId,
            senderName: currentUserInfo.nickname,
            groupId: currentUserInfo.groupId,
            avatar: currentUserInfo.avatar,
            groupAvatar: currentUserInfo.groupAvatar,
            permission: currentUserInfo.permission,
            text: text,
            images: imageUrls,
            timestamp: Date.now()
        };
        receiveAndDisplayMessage(newMessage);
        clearInput();
        messageInput.focus();
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(newMessage));
        } else {
            connectCloversServer();
        }
    });
}
function renderImagePreview(file: File, index: number): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
        const url = e.target?.result as string;

        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.dataset.index = index.toString();

        const img = document.createElement('img');
        img.className = 'preview-image';
        img.src = url;
        img.alt = '预览图';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.textContent = 'x';
        removeBtn.title = '移除图片';
        removeBtn.onclick = () => removeImage(index);

        previewItem.appendChild(img);
        previewItem.appendChild(removeBtn);
        imagePreviewArea.appendChild(previewItem);

        imagePreviewArea.classList.add('active');
    };
    reader.readAsDataURL(file);
}

/**
 * 移除待发送图片
 * @param index 待移除图片在 `pendingImages` 中的索引
 */
function removeImage(index: number): void {
    pendingImages.splice(index, 1);

    // 重新渲染预览区
    imagePreviewArea.innerHTML = '';
    if (pendingImages.length > 0) {
        pendingImages.forEach((file, newIndex) => {
            renderImagePreview(file, newIndex);
        });
    } else {
        imagePreviewArea.classList.remove('active');
    }
}

function receiveAndDisplayMessage(message: ChatMessage): void {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.dataset.id = message.id.toString();

    if (message.type === 'system') {
        // 系统消息
        messageElement.classList.add('system');
        messageElement.innerHTML = `<p class="system-text">${message.text}</p>`;
    } else if (message.type === 'user') {
        // 用户消息
        const isSelf = message.senderName === currentUserInfo.nickname;
        messageElement.classList.add(isSelf ? 'self' : 'other');

        // 用户头像/容器 (这里简化，只用一个div包裹)
        const contentContainer = document.createElement('div');
        contentContainer.className = 'content-container';

        // 用户名
        const usernameEl = document.createElement('p');
        usernameEl.className = 'username';
        usernameEl.textContent = message.senderName;

        // 消息内容气泡
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        // 文本内容
        if (message.text) {
            const textEl = document.createElement('p');
            textEl.className = 'message-text';
            textEl.textContent = message.text;
            messageContent.appendChild(textEl);
        }

        // 图片内容
        if (message.images && message.images.length > 0) {
            const imageGroup = document.createElement('div');
            imageGroup.className = 'image-group';

            message.images.forEach(imgUrl => {
                const img = document.createElement('img');
                img.className = 'message-image-item';
                img.src = imgUrl;
                img.alt = '聊天图片';
                // 实际应用中可以给图片添加点击查看大图的事件
                imageGroup.appendChild(img);
            });
            messageContent.appendChild(imageGroup);
        }

        // 组织结构: [用户名] -> [消息内容气泡]
        contentContainer.appendChild(usernameEl);
        contentContainer.appendChild(messageContent);
        messageElement.appendChild(contentContainer);
    }

    chatWindow.appendChild(messageElement);
    scrollToBottom();
}


userinfoBtn.addEventListener('click', () => {
    // 创建一个简单的模态框来替代多个prompt
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>请输入用户信息</h3>
            <div class="form-group">
                <label for="userId">用户ID:</label>
                <input type="text" id="userId" value="${currentUserInfo.userId}">
            </div>
            <div class="form-group">
                <label for="nickname">昵称:</label>
                <input type="text" id="nickname" value="${currentUserInfo.nickname}">
            </div>
            <div class="form-group">
                <label for="groupId">群组ID:</label>
                <input type="text" id="groupId" value="${currentUserInfo.groupId}">
            </div>
            <div class="form-group">
                <label for="avatarUrl">用户头像URL:</label>
                <input type="text" id="avatarUrl" value="${currentUserInfo.avatar}">
            </div>
            <div class="form-group">
                <label for="permission">用户权限:</label>
                <select id="permission">
                    <option value="SuperUser" ${currentUserInfo.permission === 'SuperUser' ? 'selected' : ''}>超级用户</option>
                    <option value="Owner" ${currentUserInfo.permission === 'Owner' ? 'selected' : ''}>群主</option>
                    <option value="Admin" ${currentUserInfo.permission === 'Admin' ? 'selected' : ''}>管理员</option>
                    <option value="Member" ${currentUserInfo.permission === 'Member' ? 'selected' : ''}>成员</option>
                </select>
            </div>
            <div class="form-actions">
                <button id="confirmBtn">确认</button>
                <button id="cancelBtn">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const confirmBtn = modal.querySelector('#confirmBtn') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#cancelBtn') as HTMLButtonElement;
    confirmBtn.addEventListener('click', () => {
        const userId = (modal.querySelector('#userId') as HTMLInputElement).value.trim();
        const nickname = (modal.querySelector('#nickname') as HTMLInputElement).value.trim();
        const groupId = (modal.querySelector('#groupId') as HTMLInputElement).value.trim();
        const avatarUrl = (modal.querySelector('#avatarUrl') as HTMLInputElement).value.trim();
        const permission = (modal.querySelector('#permission') as HTMLSelectElement).value as UserInfo['permission'];

        if (!userId || !nickname || !groupId || !permission) {
            alert('请填写所有必填项');
            return;
        }

        currentUserInfo = {
            userId,
            groupId,
            nickname,
            avatar: avatarUrl || currentUserInfo.avatar,
            groupAvatar: currentUserInfo.groupAvatar,
            permission
        };

        // 发送系统消息通知更改
        receiveAndDisplayMessage({
            id: currentMessageId++,
            senderId: '',
            type: 'system',
            senderName: '系统',
            text: "已更新用户信息。",
            timestamp: Date.now()
        });
        // 移除模态框
        document.body.removeChild(modal);
    });
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
});

function handleIncomingMessage(messageData: string): void {
    try {
        const message: ChatMessage = JSON.parse(messageData);
        if (!message.senderName || !message.text) {
            console.warn("Received malformed message:", message);
            return;
        }
        message.id = currentMessageId++;
        if (!message.timestamp) message.timestamp = Date.now();
        // 服务器发来的消息一律视为其他用户或系统消息
        receiveAndDisplayMessage(message);

    } catch (e) {
        // 如果不是 JSON，可能是纯文本系统消息
        receiveAndDisplayMessage({
            id: currentMessageId++,
            type: 'system', // 将无法解析的消息视为系统文本
            senderId: '',
            senderName: '服务器',
            text: `[原始数据]: ${messageData}`,
            timestamp: Date.now()
        });
        console.error("Error parsing incoming message:", e, messageData);
    }
}

function connectCloversServer(): void {
    if (!currentCloversServer.startsWith('ws://') && !currentCloversServer.startsWith('wss://')) {
        receiveAndDisplayMessage({
            id: currentMessageId++,
            type: 'system',
            senderId: '',
            senderName: '系统',
            text: `连接失败: 地址格式错误。请使用 ws:// 或 wss:// 开头。`,
            timestamp: Date.now()
        });
        return;
    }
    if (ws) {
        if (ws.url === currentCloversServer && ws.readyState === WebSocket.OPEN) {
            return;
        }
        ws.close(1000, "Changing server address");
        ws = null;
    }

    try {
        ws = new WebSocket(currentCloversServer);
        ws.onopen = (event) => {
            receiveAndDisplayMessage({
                id: currentMessageId++,
                type: 'system',
                senderId: '',
                senderName: '系统',
                text: `连接成功！已连接到 ${currentCloversServer}`,
                timestamp: Date.now()
            });
        };
        ws.onmessage = (event) => {
            console.log("Received message:", event.data);
            handleIncomingMessage(event.data);
        };
        ws.onclose = (event) => {
            let reason = event.reason || "服务器关闭";
            if (event.code !== 1000 && event.code !== 1005) { // 1000: 正常关闭
                reason = `连接异常关闭 (代码: ${event.code})`;
            }
            receiveAndDisplayMessage({
                id: currentMessageId++,
                type: 'system',
                senderId: '',
                senderName: '系统',
                text: `连接已断开: ${reason}`,
                timestamp: Date.now()
            });
        };

        ws.onerror = (event) => {
            receiveAndDisplayMessage({
                id: currentMessageId++,
                type: 'system',
                senderId: '',
                senderName: '系统',
                text: 'WebSocket 错误: 无法连接或连接中断。',
                timestamp: Date.now()
            });
            console.error("WebSocket Error:", event);
        };

    } catch (error) {
        receiveAndDisplayMessage({
            id: currentMessageId++,
            type: 'system',
            senderId: '',
            senderName: '系统',
            text: `WebSocket 实例化失败: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now()
        });
    }
}


cloversBtn.addEventListener('click', () => {
    const newCloversServer = prompt('请输入 clovers 服务器地址:', currentCloversServer);
    if (newCloversServer && newCloversServer.trim()) {
        connectCloversServer();
    }
});


imageUploadBtn.addEventListener('click', () => {
    imageUpload.click(); // 触发文件输入框点击
});

imageUpload.addEventListener('change', (event: Event) => {
    const files = (event.target as HTMLInputElement).files;
    if (files) {
        // 将新选择的文件添加到待发送列表
        for (let i = 0; i < files.length; i++) {
            if (files[i].type.startsWith('image/')) {
                pendingImages.push(files[i]);
            }
        }

        imagePreviewArea.innerHTML = '';
        pendingImages.forEach((file, index) => {
            renderImagePreview(file, index);
        });
    }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (event: KeyboardEvent) => {
    // 检查是否按下了回车键 (Key: 'Enter', Code: 'Enter')
    if (event.key === 'Enter') {
        if (event.shiftKey) {
            // 添加换行符
        } else {
            event.preventDefault();
            sendMessage();
        }
    }
});

// 初始化加载时添加一条系统消息
document.addEventListener('DOMContentLoaded', () => {
    receiveAndDisplayMessage({
        id: currentMessageId++,
        type: 'system',
        senderId: '',
        senderName: '系统',
        text: '欢迎来到 clovers 终端！',
        timestamp: Date.now()
    });
    connectCloversServer();
});