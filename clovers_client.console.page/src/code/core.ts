import type { UserInfo, GroupInfo, ChatMessage, ConsoleMessage } from "./types";
import { WebSocketClient } from "./websocket";
import { systemMessage, chatMessage, chatWindow } from "./chat";
import { setItem } from "./tools";

export const defaultUserInfo: UserInfo = {
    userId: "1",
    userName: "User",
    avatar: "",
    permission: "Member",
};
export const defaultGroupInfo: GroupInfo = {
    groupId: "1",
    groupName: "Group",
    avatar: "",
    flag: true,
};

export class CloversManager {
    public currentUser!: UserInfo;
    public userList: UserInfo[];
    public currentGroup!: GroupInfo;
    public groupList: GroupInfo[];
    public client: WebSocketClient;

    constructor() {
        this.userList = [];
        CloversManager.initList("userList", this.userList);
        this.setCurrentUser(localStorage.getItem("userId") || "1");
        this.groupList = [];
        CloversManager.initList("groupList", this.groupList);
        this.setCurrentGroup(localStorage.getItem("groupId") || "1");
        this.client = new WebSocketClient(this.receiveHandle.bind(this));
        this.client.connect();
    }

    private static initList(key: string, list: any[]) {
        try {
            const str = localStorage.getItem(key);
            if (str) {
                list.push(...JSON.parse(str));
            }
        } catch (error) {
            localStorage.removeItem(key);
            console.error(`Error parsing ${key}:`, error);
        }
    }
    private static moveTop(list: any[], condition: (item: any) => boolean) {
        if (list.length < 1) return false;
        const index = list.findIndex(condition);
        if (index === -1) return false;
        const user = list[index];
        list.splice(index, 1);
        list.unshift(user);
        return true;
    }

    public setCurrentUser(userId: string) {
        if (!CloversManager.moveTop(this.userList, (user) => user.userId === userId)) {
            this.userList.push({ ...defaultUserInfo, userId: userId });
        }
        this.currentUser = this.userList[0];
        localStorage.setItem("userId", userId);
        localStorage.setItem("userList", JSON.stringify(this.userList));
    }
    public setCurrentGroup(groupId: string) {
        if (!CloversManager.moveTop(this.groupList, (group) => group.groupId === groupId)) {
            this.groupList.push({ ...defaultGroupInfo, groupId: groupId });
        }
        this.currentGroup = this.groupList[0];
        localStorage.setItem("groupId", groupId);
        localStorage.setItem("groupList", JSON.stringify(this.groupList));
    }
    public deleteUser(userId: string) {
        const index = this.userList.findIndex((user) => user.userId === userId);
        if (index === -1) return;
        this.userList.splice(index, 1);
        if (this.currentUser.userId === userId) {
            if (this.userList.length > 0) this.setCurrentUser(this.userList[0].userId);
            else this.setCurrentUser("1");
        } else localStorage.setItem("userList", JSON.stringify(this.userList));
    }

    public deleteGroup(groupId: string) {
        const index = this.groupList.findIndex((group) => group.groupId === groupId);
        if (index === -1) return;
        this.groupList.splice(index, 1);
        if (this.currentGroup.groupId === groupId) {
            if (this.groupList.length > 0) this.setCurrentGroup(this.groupList[0].groupId);
            else this.setCurrentGroup("1");
        } else localStorage.setItem("groupList", JSON.stringify(this.groupList));
    }

    public userSave() {
        localStorage.setItem("userList", JSON.stringify(this.userList));
    }
    public groupSave() {
        localStorage.setItem("groupList", JSON.stringify(this.groupList));
    }

    public hasUser(userId: string): boolean {
        return this.userList.some((user) => user.userId === userId);
    }

    public hasGroup(groupId: string): boolean {
        return this.groupList.some((group) => group.groupId === groupId);
    }

    private receiveHandle(message: ChatMessage | ConsoleMessage): void {
        if (message.type === "system") {
            const [title, groupId, msg] = message["data"];
            switch (title) {
                case "log": {
                    if (groupId === this.currentGroup.groupId) {
                        chatWindow.appendChild(systemMessage(msg));
                        chatWindow.scrollTop = chatWindow.scrollHeight;
                    }
                    return;
                }
                case "title": {
                    const group = this.groupList.find((group) => group.groupId === groupId);
                    if (!group) return;
                    group.groupName = title;
                    const strongElement = document.getElementById(`groupItem${groupId}`) as HTMLDivElement;
                    if (!strongElement) return;
                    setItem(strongElement, null, "none", msg, null);
                    return;
                }
            }
        } else
            chatMessage(message, message.senderId == this.currentUser.userId).then((msg) => {
                if (message.groupId === this.currentGroup.groupId) {
                    chatWindow.appendChild(msg);
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                } else {
                    const strongElement = document.getElementById(`groupItem${message.groupId}`) as HTMLDivElement;
                    if (!strongElement) return;
                    setItem(strongElement, null, "tip", null, message.text);
                }
            });
    }

    public send(text: string, images: string[] = []) {
        const message: ChatMessage = {
            type: "user",
            senderId: this.currentUser.userId,
            senderName: this.currentUser.userName,
            groupId: this.currentGroup.groupId,
            avatar: this.currentUser.avatar,
            groupAvatar: this.currentGroup.avatar,
            permission: this.currentUser.permission,
            text: text,
            images: images,
        };
        this.client.send(message);
    }
}
