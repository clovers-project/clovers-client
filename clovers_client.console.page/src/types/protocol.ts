/**
 * protocol.ts —— 与后端约定的数据格式，以及前端自己的消息模型。
 *
 * 【重要】Clovers 协议相关的字段名（type/text/at/reply/senderId/...）
 * 属于前后端契约，改动会影响服务端，请勿随意重命名。
 * 而 ChatRecord 是前端本地模型，可以自由演进而无需后端配合。
 */

export type Permission = 'SuperUser' | 'Owner' | 'Admin' | 'Member';

export const PERMISSION_LABEL: Record<Permission, string> = {
    SuperUser: '超级用户',
    Owner: '群主',
    Admin: '管理员',
    Member: '成员',
};

export interface UserInfo {
    userId: string;
    userName: string;
    avatar: string;
    permission: Permission;
}

export interface GroupInfo {
    groupId: string;
    groupName: string;
    avatar: string;
}

/* ------------------------------ 服务端 -> 客户端 ------------------------------ */

export interface ServerUserMessage {
    type: 'user';
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
    permission: Permission;
    messageId?: string;
    echo?: string;
}


export type ConsoleMessageData = string[];

export interface ServerSystemMessage {
    type: 'system';
    data: ConsoleMessageData;
    messageId?: string;
}

export type ServerMessage = ServerUserMessage | ServerSystemMessage;

/* ------------------------------ 客户端 -> 服务端 ------------------------------ */

export interface ClientUserMessage {
    type: 'user';
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
    permission: Permission;
    echo?: string;
}

/* ------------------------------ 本地消息模型 ------------------------------ */

export type MessageStatus = 'sent' | 'sending' | 'failed';

export interface ChatRecord {
    /** 优先使用服务端 messageId，缺失时由前端生成 */
    id: string;
    groupId: string;
    senderId: string;
    senderName: string;
    avatar: string;
    permission: Permission;
    text: string;
    images: string[];
    /** 被 @ 的用户 ID 列表 */
    at: string[];
    /** 引用回复的消息 id */
    reply: string | null;
    /** 毫秒时间戳（本地接收/发送时间） */
    time: number;
    /** 由本机当前身份发出 */
    self: boolean;
    status: MessageStatus;
    /** 发送时带上的回显标记，收到同 echo 的广播后用来对上号 */
    echo?: string;
}

export interface SystemRecord {
    id: string;
    groupId: string;
    time: number;
    text: string;
}

export type FeedItem = | ({ kind: 'user' } & ChatRecord) | ({ kind: 'system' } & SystemRecord);

export type ConnectionState = 'connecting' | 'online' | 'offline';
