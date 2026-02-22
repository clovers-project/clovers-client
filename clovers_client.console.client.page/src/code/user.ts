import './types'
import { userList, setCurrentUser, defaultUserInfo, currentUser } from "./core";
import { sendSystemMessage } from './chat'
import { creatModal } from "./modal";
function userInfoTemplate({ backdrop, modal } = creatModal(), user: UserInfo) {
    const content = document.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `
<h3>请输入用户信息</h3>
<div class="form-group">
    <label for="nickname">用户名称:</label>
    <input type="text" id="nickname" value="${user.userName}">
</div>
<div class="form-group">
    <label for="userId">用户ID:</label>
    <input type="text" id="userId" value="${user.userId}">
</div>
<div class="form-group">
    <label for="avatarUrl">用户头像URL:</label>
    <input type="text" id="avatarUrl" value="${user.avatar}">
</div>
<div class="form-group">
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
    btns.className = "form-actions";
    btns.appendChild(confirmBtn);
    btns.appendChild(cancelBtn);
    btns.appendChild(deleteBtn);
    content.appendChild(btns);
    modal.appendChild(content);
    confirmBtn.onclick = () => {
        const userId = (content.querySelector("#userId") as HTMLInputElement).value.trim();
        const nickname = (content.querySelector("#nickname") as HTMLInputElement).value.trim();
        const avatarUrl = (content.querySelector("#avatarUrl") as HTMLInputElement).value.trim();
        const permission = (content.querySelector("#permission") as HTMLSelectElement).value as UserInfo["permission"];
        user.userId = userId;
        user.userName = nickname;
        user.avatar = avatarUrl;
        user.permission = permission;
        document.body.removeChild(backdrop);
        renderUserList();
        localStorage.setItem("userList", JSON.stringify(userList));
    };
    cancelBtn.onclick = () => {
        modal.innerHTML = "";
        renderUserList({ backdrop, modal });
    };
    deleteBtn.onclick = () => {
        if (currentUser.userId === user.userId) {
            setCurrentUser('1');
            localStorage.setItem("userId", currentUser.userId);
        };
        const index = userList.indexOf(user);
        if (index !== -1) userList.splice(index, 1);
        document.body.removeChild(backdrop);
        renderUserList();
        localStorage.setItem("userList", JSON.stringify(userList));
    };
}

export function renderUserList({ backdrop, modal } = creatModal()) {
    function renderUserItem(user: UserInfo) {
        const userItem = document.createElement("div");
        userItem.className = "itemlist-item";
        const avatar = user.avatar ? `<img src="${user.avatar}" class="itemlist-item-avatar">` : '<div class="itemlist-item-avatar"></div>';
        userItem.innerHTML = `<div class="grow-flex">${avatar}<strong>${user.userName}:</strong><span>${user.userId}</span></div>`;
        const setting = document.createElement("button");
        setting.className = "tool-btn";
        setting.innerHTML = '<i class="fa-solid fa-gear"></i>';
        userItem.appendChild(setting);
        userItem.addEventListener("click", () => {
            document.body.removeChild(backdrop);
            if (currentUser.userId === user.userId) return;
            setCurrentUser(user.userId);
            sendSystemMessage(`已切换用户为「${user.userName}」`);
            localStorage.setItem("userId", user.userId);
        });
        setting.addEventListener("click", (e) => {
            e.stopPropagation();
            modal.innerHTML = "";
            userInfoTemplate({ backdrop, modal }, user);
        });
        return userItem;
    }
    const content = document.createElement("div");
    content.className = "modal-content"
    const title = document.createElement("div");
    title.className = "itemlist-title";
    title.innerHTML = '<div class="grow-flex"><h3>用户列表</h3></div>';
    const addUserBtn = document.createElement("button");
    addUserBtn.id = "roundBtn";
    addUserBtn.className = "confirm-button";
    addUserBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    addUserBtn.onclick = () => {
        let user = { ...defaultUserInfo, groupId: Date.now().toString() };
        userList.push(user);
        content.appendChild(renderUserItem(user));
        localStorage.setItem("userList", JSON.stringify(userList));
    };
    title.appendChild(addUserBtn);
    content.appendChild(title);
    if (userList.length === 0) setCurrentUser("1");
    userList.forEach((user) => content.appendChild(renderUserItem(user)));
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.className = "delete-all-button";
    deleteAllBtn.innerHTML = '<i class="fa-solid fa-trash"></i>'
    deleteAllBtn.onclick = () => {
        userList.length = 0;
        setCurrentUser("1");
        localStorage.setItem("userList", JSON.stringify(userList));
        modal.innerHTML = "";
        renderUserList({ backdrop, modal });
    };
    modal.appendChild(content);
    modal.appendChild(deleteAllBtn);
}