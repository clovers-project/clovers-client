import './types'
import { groupList, setCurrentGroup, defaultGroupInfo, currentGroup } from "./core";
import { chatWindow } from "./chat";
import { creatModal } from "./modal";
import { openDB } from 'idb';

const dbPromise = openDB('ChatAppDB', 1, {
    upgrade(db) {
        // 创建一个名为 "histories" 的表，以 groupId 作为键
        if (!db.objectStoreNames.contains('histories')) {
            db.createObjectStore('histories');
        }
    },
});

const chatHistoryStorage = {
    async set(groupId: string, html: string) {
        const db = await dbPromise;
        await db.put('histories', html, groupId);
    },
    async get(groupId: string): Promise<string> {
        const db = await dbPromise;
        return (await db.get('histories', groupId)) || '';
    },
    async delete(groupId: string) {
        const db = await dbPromise;
        await db.delete('histories', groupId);
    },
    async clearAll() {
        const db = await dbPromise;
        await db.clear('histories');
    }

};

const sideBarArea = document.getElementById("sideBarArea") as HTMLDivElement;
const sideBarContent = document.getElementById("sideBarContent") as HTMLDivElement;
const sideBarTitle = document.getElementById("sideBarTitle") as HTMLDivElement;

function renderGroupItem(group: GroupInfo) {
    const groupItem = document.createElement("div");
    groupItem.className = "itemlist-item";
    const avatar = group.avatar ? `<img src="${group.avatar}" class="itemlist-item-avatar">` : '<div class="itemlist-item-avatar"></div>';
    groupItem.innerHTML = `<div class="grow-flex">${avatar}<strong>${group.groupName}</strong></div>`;
    const setting = document.createElement("button");
    setting.className = "tool-btn";
    setting.innerHTML = '<i class="fa-solid fa-gear"></i>';
    groupItem.appendChild(setting);
    groupItem.addEventListener("click", async () => {
        if (currentGroup.groupId === group.groupId) return;
        const chatHistory = chatWindow.cloneNode(true) as HTMLDivElement;
        chatHistory.querySelectorAll('div.message.system').forEach(el => el.remove());
        await chatHistoryStorage.set(currentGroup.groupId, chatHistory.innerHTML);
        chatWindow.innerHTML = await chatHistoryStorage.get(group.groupId);
        setCurrentGroup(group.groupId);
        localStorage.setItem("groupId", group.groupId);
    });
    setting.addEventListener("click", (e) => {
        e.stopPropagation();
        groupInfoTemplate(creatModal(), group);
    });
    return groupItem;
}
export function renderGroupList() {
    if (groupList.length === 0) setCurrentGroup('1');
    sideBarContent.innerHTML = "";
    groupList.forEach((group) => sideBarContent.appendChild(renderGroupItem(group)));
    sideBarTitle.innerHTML = '<div class="grow-flex"><strong>会话列表</strong></div>';;
    const addGroupBtn = document.createElement("button");
    addGroupBtn.className = "tool-btn";
    addGroupBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    sideBarTitle.appendChild(addGroupBtn);
    addGroupBtn.onclick = () => {
        let group = { ...defaultGroupInfo, groupId: Date.now().toString() };
        groupList.push(group);
        sideBarContent.appendChild(renderGroupItem(group));
        localStorage.setItem("groupList", JSON.stringify(groupList));
    };
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.className = "delete-all-button";
    deleteAllBtn.innerHTML = '<i class="fa-solid fa-trash"></i>'
    deleteAllBtn.onclick = async () => {
        groupList.length = 0;
        setCurrentGroup("1");
        localStorage.setItem("groupList", JSON.stringify(groupList));
        sideBarContent.innerHTML = ""
        groupList.forEach((group) => sideBarContent.appendChild(renderGroupItem(group)));
        await chatHistoryStorage.clearAll();
    };
    const grow = document.createElement("div");
    grow.className = "grow-flex";
    sideBarArea.appendChild(grow);
    sideBarArea.appendChild(deleteAllBtn);
}
function groupInfoTemplate({ backdrop, modal } = creatModal(), group: GroupInfo) {
    const content = document.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `
<h3>请输入会话信息</h3>
<div class="form-group">
    <label for="nickname">会话名称:</label>
    <input type="text" id="groupName" value="${group.groupName}">
</div>
<div class="form-group">
    <label for="groupId">会话ID:</label>
    <input type="text" id="groupId" value="${group.groupId}">
</div>
<div class="form-group">
    <label for="avatarUrl">会话头像URL:</label>
    <input type="text" id="groupAvatarUrl" value="${group.avatar}">
</div>`;
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "confirm-button";
    confirmBtn.textContent = "确认";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "cancle-button";
    cancelBtn.textContent = "取消";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-button";
    deleteBtn.textContent = "删除";
    const btns = document.createElement("div");
    btns.className = "form-actions";
    btns.appendChild(confirmBtn);
    btns.appendChild(cancelBtn);
    btns.appendChild(deleteBtn);
    content.appendChild(btns);
    modal.appendChild(content);
    confirmBtn.onclick = () => {
        group.groupName = (content.querySelector("#groupName") as HTMLInputElement).value.trim();
        group.groupId = (content.querySelector("#groupId") as HTMLInputElement).value.trim();
        group.avatar = (content.querySelector("#groupAvatarUrl") as HTMLInputElement).value.trim();
        sideBarContent.innerHTML = ""
        groupList.forEach((group) => sideBarContent.appendChild(renderGroupItem(group)));
        document.body.removeChild(backdrop);
        localStorage.setItem("groupList", JSON.stringify(groupList));
    };
    cancelBtn.onclick = () => document.body.removeChild(backdrop);
    deleteBtn.onclick = async () => {
        if (currentGroup.groupId === group.groupId) {
            setCurrentGroup('1');
            localStorage.setItem("groupId", currentGroup.groupId);
            chatWindow.innerHTML = await chatHistoryStorage.get(currentGroup.groupId);

        };
        const index = groupList.indexOf(group);
        if (index !== -1) groupList.splice(index, 1);
        sideBarContent.innerHTML = ""
        groupList.forEach((group) => sideBarContent.appendChild(renderGroupItem(group)));
        document.body.removeChild(backdrop);
        localStorage.setItem("groupList", JSON.stringify(groupList));
        chatHistoryStorage.delete(group.groupId);
    };
}


