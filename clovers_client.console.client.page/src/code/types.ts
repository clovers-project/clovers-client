interface ChatMessage {
    id: number; // 消息唯一ID
    type: "system" | "user"; // 消息类型
    senderId: string; // 发送者ID (系统消息可为空)
    senderName: string; // 发送者用户名
    groupId?: string; // 群组ID (可选)
    avatar?: string;
    groupAvatar?: string;
    permission?: "SuperUser" | "Owner" | "Admin" | "Member";
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
    userName: string;
    avatar: string;
    permission: "SuperUser" | "Owner" | "Admin" | "Member";
}

interface GroupInfo {
    groupId: string;
    groupName: string;
    avatar: string;
}