export interface UserInfo {
    userId: string;
    userName: string;
    avatar: string;
    permission: "SuperUser" | "Owner" | "Admin" | "Member";
}

export interface GroupInfo {
    groupId: string;
    groupName: string;
    avatar: string;
    flag: boolean;
}

export interface ChatMessage {
    type: "user";
    text: string;
    images: string[];
    senderId: string;
    senderName: string;
    avatar: string;
    groupId: string;
    groupAvatar: string;
    permission: "SuperUser" | "Owner" | "Admin" | "Member";
}

type ConsoleMessageData = [string, string, string]

export interface ConsoleMessage {
    type: "system"
    data: ConsoleMessageData;
}