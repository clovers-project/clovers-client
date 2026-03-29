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
    at: string[];
    reply: string | null;
    senderId: string;
    senderName: string;
    avatar: string;
    groupId: string;
    groupName: string;
    groupAvatar: string;
    permission: "SuperUser" | "Owner" | "Admin" | "Member";
    messageId?: string;
}

type ConsoleMessageData = [string, string, string]

export interface ConsoleMessage {
    type: "system"
    data: ConsoleMessageData;
}