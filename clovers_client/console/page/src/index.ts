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
const defaultUser: UserInfo = {
    userId: '1',
    groupId: '1',
    nickname: '用户',
    avatar: "",
    groupAvatar: "",
    permission: 'SuperUser'
};
let currentUserInfo: UserInfo = { ...defaultUser };
let userList: UserInfo[] = [currentUserInfo];
userList.push();
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
        messageElement.appendChild(usernameEl);
        messageElement.appendChild(messageContent);
    }
    chatWindow.appendChild(messageElement);
    scrollToBottom();
}

// 替换原有的 userinfoBtn 点击事件处理函数
function renderUserList() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const modalHTML = document.createElement('div');
    modalHTML.className = 'modal-content';
    const title = document.createElement('div');
    title.className = 'user-list-title';
    title.textContent = '用户列表';
    modalHTML.appendChild(title);
    const addUserBtn = document.createElement('button');
    addUserBtn.id = 'addUserBtn';
    addUserBtn.textContent = '+';
    title.appendChild(addUserBtn);
    function renderUserItem(user: UserInfo) {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div>
                <strong>${user.nickname}</strong>
                <span>ID: ${user.userId}</span>
            </div>
          `;
        const setting = document.createElement('button');
        setting.className = 'tool-btn';
        setting.innerHTML = '<i class="fa-solid fa-gear"></i>';
        userItem.appendChild(setting);
        userItem.addEventListener('click', () => {
            document.body.removeChild(modal)
            currentUserInfo = user
            receiveAndDisplayMessage({
                id: currentMessageId++,
                type: 'system',
                senderId: '',
                senderName: '系统',
                text: `已切换用户为「${user.nickname}」`,
                timestamp: Date.now()
            });
        });
        setting.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.removeChild(modal)
            renderUserInfoPage(user)
        });
        return userItem;
    }
    userList.forEach(user => {
        modalHTML.appendChild(renderUserItem(user));

    });
    addUserBtn.onclick = () => {
        let user = { ...defaultUser };
        userList.push(user);
        modalHTML.appendChild(renderUserItem(user));
    };
    modal.appendChild(modalHTML);
    document.body.appendChild(modal);

};

function renderUserInfoPage(user: UserInfo) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const modalHTML = document.createElement('div');
    modalHTML.className = 'modal-content';
    modalHTML.innerHTML = `
        <h3>请输入用户信息</h3>
        <div class="form-group">
            <label for="userId">用户ID:</label>
            <input type="text" id="userId" value="${user.userId}">
        </div>
        <div class="form-group">
            <label for="nickname">昵称:</label>
            <input type="text" id="nickname" value="${user.nickname}">
        </div>
        <div class="form-group">
            <label for="groupId">群组ID:</label>
            <input type="text" id="groupId" value="${user.groupId}">
        </div>
        <div class="form-group">
            <label for="avatarUrl">用户头像URL:</label>
            <input type="text" id="avatarUrl" value="${user.avatar}">
        </div>
        <div class="form-group">
            <label for="groupAvatarUrl">群组头像URL:</label>
            <input type="text" id="groupAvatarUrl" value="${user.groupAvatar}">
        </div>
        <div class="form-group">
            <label for="permission">用户权限:</label>
            <select id="permission">
                <option value="SuperUser" ${user.permission === 'SuperUser' ? 'selected' : ''}>超级用户</option>
                <option value="Owner" ${user.permission === 'Owner' ? 'selected' : ''}>群主</option>
                <option value="Admin" ${user.permission === 'Admin' ? 'selected' : ''}>管理员</option>
                <option value="Member" ${user.permission === 'Member' ? 'selected' : ''}>成员</option>
            </select>
        </div>
        `;
    const btns = document.createElement('div');
    btns.className = 'form-actions';
    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'confirmBtn';
    confirmBtn.textContent = '确认';
    btns.appendChild(confirmBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelBtn';
    cancelBtn.textContent = '取消';
    btns.appendChild(cancelBtn);
    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'deleteBtn';
    deleteBtn.textContent = '删除';
    btns.appendChild(deleteBtn);
    modalHTML.appendChild(btns);
    modal.appendChild(modalHTML);
    document.body.appendChild(modal);
    confirmBtn.onclick = () => {
        const userId = (modalHTML.querySelector('#userId') as HTMLInputElement).value.trim();
        const nickname = (modalHTML.querySelector('#nickname') as HTMLInputElement).value.trim();
        const groupId = (modalHTML.querySelector('#groupId') as HTMLInputElement).value.trim();
        const avatarUrl = (modalHTML.querySelector('#avatarUrl') as HTMLInputElement).value.trim();
        const groupAvatarUrl = (modalHTML.querySelector('#groupAvatarUrl') as HTMLInputElement).value.trim();
        const permission = (modalHTML.querySelector('#permission') as HTMLSelectElement).value as UserInfo['permission'];
        user.userId = userId;
        user.nickname = nickname;
        user.groupId = groupId;
        user.avatar = avatarUrl;
        user.groupAvatar = groupAvatarUrl;
        user.permission = permission;
        document.body.removeChild(modal);
        renderUserList();
    }
    cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        renderUserList();
    }
    deleteBtn.onclick = () => {
        const index = userList.indexOf(user);
        if (index !== -1) {
            userList.splice(index, 1);
        }
        document.body.removeChild(modal);
        renderUserList();
    }
}

userinfoBtn.addEventListener('click', renderUserList);
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