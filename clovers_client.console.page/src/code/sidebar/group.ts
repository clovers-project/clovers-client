import type { ChatMessage, GroupInfo } from '../types';
import type { CloversManager } from "../core";
import { chatWindow, chatHistoryStorage, systemMessage } from "../chat";
import { creatModal } from "../modal";
import { sideBarArea, sideBarContent, sideBarTitle } from ".";
import { itemHTML, setItem } from "../tools";

const groupListBtn = document.getElementById("groupListBtn") as HTMLButtonElement;

let showGroupListFlag = false;
function showSideBar(e: PointerEvent) {
    sideBarArea.classList.add('active');
    showGroupListFlag = true;
    e.stopPropagation();
}
function hideSideBar(e: PointerEvent) {
    if (showGroupListFlag && !sideBarArea.contains(e.target as Node)) {
        sideBarArea.classList.remove('active');
        showGroupListFlag = false;
    }
}
groupListBtn.onclick = showSideBar;
document.addEventListener('click', (e) => { hideSideBar(e); });

export function appendGroupItem(manager: CloversManager, message: ChatMessage) {
    const group = manager.appendGroup(message.groupId);
    group.avatar = message.groupAvatar;
    group.groupName = message.groupName;
    manager.groupSave();
    const groupItem = renderGroupItem(manager, group);
    sideBarContent.appendChild(groupItem)
    return groupItem;
}

export function init(manager: CloversManager) {
    showGroupChatHistory(manager.currentGroup.groupId);
    const addGroupBtn = document.createElement("button");
    addGroupBtn.className = "tool-btn";
    addGroupBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    addGroupBtn.onclick = () => {
        const groupId = Date.now().toString();
        if (manager.hasGroup(groupId)) return;
        const group = manager.appendGroup(groupId);
        manager.groupSave();
        const groupItem = renderGroupItem(manager, group);
        sideBarContent.appendChild(groupItem)
    };
    sideBarTitle.appendChild(addGroupBtn);
    setItem(sideBarTitle, manager.currentUser.avatar, null, manager.currentUser.userName, null)
    sideBarContent.innerHTML = "";
    manager.groupList.forEach((group) => sideBarContent.appendChild(renderGroupItem(manager, group)));
}

function showGroupChatHistory(groupId: string, info?: string) {
    chatHistoryStorage.get(groupId).then((history) => {
        chatWindow.innerHTML = "";
        if (info) chatWindow.appendChild(systemMessage(info));
        chatWindow.innerHTML += history;
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });
}
function renderGroupItem(manager: CloversManager, group: GroupInfo) {
    const groupItem = document.createElement("div");
    groupItem.className = "itemlist-item";
    groupItem.id = `groupItem${group.groupId}`;
    groupItem.innerHTML = itemHTML;
    setItem(groupItem, group.avatar, null, group.groupName, null);
    const setting = document.createElement("button");
    setting.className = "tool-btn";
    setting.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    groupItem.appendChild(setting);
    groupItem.onclick = () => {
        if (manager.currentGroup.groupId === group.groupId) return;
        manager.setCurrentGroup(group.groupId);
        showGroupChatHistory(group.groupId, `当前聊天「${group.groupName}」`);
        setItem(groupItem, null, 'none', null, null)
    }
    setting.onclick = (e) => {
        e.stopPropagation();
        groupInfoTemplate(manager, group);
    }
    return groupItem;
}

function groupInfoTemplate(manager: CloversManager, group: GroupInfo, { backdrop, modal } = creatModal()) {
    const content = document.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `
<h3>请输入会话信息</h3>
<div class="modal-item">
    <label for="groupName">会话名称:</label>
    <input type="text" id="groupName" value="${group.groupName}">
</div>
<div class="modal-item">
    <label for="groupId">会话ID:</label>
    <input type="text" id="groupId" value="${group.groupId}">
</div>
<div class="modal-item">
    <label for="groupAvatarUrl">会话头像:</label>
    <div class="avatar-input">
        <input type="text" id="groupAvatarUrl" value="${group.avatar}" placeholder="输入图片 URL 或点击右侧按钮上传">
        <label for="groupAvatarUpload" class="cancle-button" title="上传图片">选择</label>
        <input type="file" id="groupAvatarUpload" accept="image/*" class="hidden" />
    </div>
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
    btns.className = "modal-buttons";
    btns.appendChild(confirmBtn);
    btns.appendChild(cancelBtn);
    btns.appendChild(deleteBtn);
    content.appendChild(btns);
    modal.appendChild(content);
    confirmBtn.onclick = () => {
        const groupIdInput = content.querySelector("#groupId") as HTMLInputElement;
        const groupId = groupIdInput.value.trim();
        if (groupId !== group.groupId && manager.hasGroup(groupId)) {
            groupIdInput.classList.add("error");
            const errorMsg = document.createElement("span");
            errorMsg.className = "error-message";
            errorMsg.textContent = "该 ID 已存在，请更换";
            groupIdInput.parentNode!.appendChild(errorMsg);
            groupIdInput.focus();
            return;
        }
        const groupItem = document.getElementById(`groupItem${group.groupId}`)! as HTMLDivElement;
        groupItem.id = `groupItem${groupId}`;
        group.groupId = groupId;
        group.groupName = (content.querySelector("#groupName") as HTMLInputElement).value.trim();
        group.avatar = (content.querySelector("#groupAvatarUrl") as HTMLInputElement).value.trim();
        setItem(groupItem, group.avatar, "none", group.groupName, "Group Info Updated");
        document.body.removeChild(backdrop);
        manager.groupSave();
    };
    cancelBtn.onclick = () => document.body.removeChild(backdrop);
    deleteBtn.onclick = () => {
        const groupItem = document.getElementById(`groupItem${group.groupId}`)! as HTMLDivElement;
        groupItem.remove();
        if (manager.currentGroup.groupId === group.groupId) {
            manager.deleteGroup(group.groupId);
            showGroupChatHistory(manager.currentGroup.groupId, `当前聊天「${manager.currentGroup.groupName}」`);
            if (!document.getElementById(`groupItem${manager.currentGroup.groupId}`)) {
                sideBarContent.appendChild(renderGroupItem(manager, manager.currentGroup));
            }
        } else {
            manager.deleteGroup(group.groupId);
        }
        chatHistoryStorage.delete(group.groupId);
        document.body.removeChild(backdrop);
    };
    const groupAvatarUpload = content.querySelector("#groupAvatarUpload") as HTMLInputElement;
    groupAvatarUpload.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const URLs = await manager.client.uploadFile([file]);
        if (URLs.length < 1) return;
        (content.querySelector("#groupAvatarUrl") as HTMLInputElement).value = URLs[0];
    };
}


