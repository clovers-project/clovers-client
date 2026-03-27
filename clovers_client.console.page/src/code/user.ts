import type { UserInfo } from "./types";
import type { CloversManager } from "./core";
import { creatModal } from "./modal";
import { itemHTML, setItem } from "./tools";
import { userListBtn, sideBarTitle } from "./sidebar";

export function init(manager: CloversManager) {
    setItem(sideBarTitle, manager.currentUser.avatar, null, manager.currentUser.userName, null)
    userListBtn.onclick = () => { renderUserList(manager) };
}

function userInfoTemplate(manager: CloversManager, user: UserInfo, { backdrop, modal } = creatModal()) {
    const content = document.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `
<h3>用户信息</h3>
<div class="modal-item">
    <label for="userName">用户名称:</label>
    <input type="text" id="userName" value="${user.userName}">
</div>
<div class="modal-item">
    <label for="userId">用户ID:</label>
    <input type="text" id="userId" value="${user.userId}">
</div>
<div class="modal-item">
    <label for="userAvatarUrl">会话头像:</label>
    <div class="avatar-input">
        <input type="text" id="userAvatarUrl" value="${user.avatar}" placeholder="输入图片 URL 或点击右侧按钮上传">
        <label for="userAvatarUpload" class="cancle-button" title="上传图片">选择</label>
        <input type="file" id="userAvatarUpload" accept="image/*" class="hidden" />
    </div>
</div>
<div class="modal-item">
    <label for="permission">用户权限:</label>
    <select id="permission">
        <option value="SuperUser" ${user.permission === "SuperUser" ? "selected" : ""}>超级用户</option>
        <option value="Owner" ${user.permission === "Owner" ? "selected" : ""}>群主</option>
        <option value="Admin" ${user.permission === "Admin" ? "selected" : ""}>管理员</option>
        <option value="Member" ${user.permission === "Member" ? "selected" : ""}>成员</option>
    </select>
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
        const userIdInput = content.querySelector("#userId") as HTMLInputElement;
        const userId = userIdInput.value.trim();
        if (userId !== user.userId && manager.hasUser(userId)) {
            userIdInput.classList.add("error");
            const errorMsg = document.createElement("span");
            errorMsg.className = "error-message";
            errorMsg.textContent = "该 ID 已存在，请更换";
            userIdInput.parentNode!.appendChild(errorMsg);
            userIdInput.focus();
            return;
        }
        user.userId = userId;
        user.userName = (content.querySelector("#userName") as HTMLInputElement).value.trim();
        user.avatar = (content.querySelector("#userAvatarUrl") as HTMLInputElement).value.trim();
        user.permission = (content.querySelector("#permission") as HTMLSelectElement).value as UserInfo["permission"];
        modal.innerHTML = "";
        renderUserList(manager, { backdrop, modal });
        manager.userSave();
    };
    cancelBtn.onclick = () => {
        modal.innerHTML = "";
        renderUserList(manager, { backdrop, modal });
    };
    deleteBtn.onclick = () => {
        manager.deleteUser(user.userId);
        modal.innerHTML = "";
        renderUserList(manager, { backdrop, modal });
    };
    const userAvatarUpload = content.querySelector("#userAvatarUpload") as HTMLInputElement;
    userAvatarUpload.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const URLs = await manager.client.uploadFile([file]);
        if (URLs.length < 1) return;
        (content.querySelector("#userAvatarUrl") as HTMLInputElement).value = URLs[0];
    };
}

function renderUserList(manager: CloversManager, { backdrop, modal } = creatModal()) {
    setItem(sideBarTitle, manager.currentUser.avatar, null, manager.currentUser.userName, null)
    function renderUserItem(user: UserInfo) {
        const userItem = document.createElement("div");
        userItem.className = "itemlist-item";
        userItem.innerHTML = itemHTML;
        setItem(userItem, user.avatar, "none", user.userName, user.userId);
        const setting = document.createElement("button");
        setting.className = "tool-btn";
        setting.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        userItem.appendChild(setting);
        userItem.onclick = () => {
            if (manager.currentUser.userId !== user.userId) {
                manager.setCurrentUser(user.userId);
                setItem(sideBarTitle, manager.currentUser.avatar, null, manager.currentUser.userName, null)
            }
            document.body.removeChild(backdrop);
        };
        setting.onclick = (e) => {
            e.stopPropagation();
            modal.innerHTML = "";
            userInfoTemplate(manager, user, { backdrop, modal });
        }
        return userItem;
    }
    const content = document.createElement("div");
    content.className = "modal-content";
    const title = document.createElement("div");
    title.className = "itemlist-title";
    title.innerHTML = '<div class="grow-flex"><h3>用户列表</h3></div>';
    const addUserBtn = document.createElement("button");
    addUserBtn.id = "roundBtn";
    addUserBtn.className = "confirm-button";
    addUserBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    addUserBtn.onclick = () => {
        const userId = Date.now().toString();
        if (manager.hasUser(userId)) return;
        manager.appendUser(userId);
        modal.innerHTML = "";
        renderUserList(manager, { backdrop, modal });
    };
    title.appendChild(addUserBtn);
    content.appendChild(title);
    manager.userList.forEach((user) => content.appendChild(renderUserItem(user)));
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.className = "delete-all-button";
    deleteAllBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteAllBtn.onclick = () => {
        manager.userList.length = 0;
        manager.userList.push(manager.currentUser);
        manager.userSave();
        modal.innerHTML = "";
        renderUserList(manager, { backdrop, modal });
    };
    modal.appendChild(content);
    modal.appendChild(deleteAllBtn);
}
