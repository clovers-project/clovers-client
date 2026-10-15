/**
 * bridge.ts —— 应用装配层。
 *
 * 把「网络层（services/client）」和「状态层（store/*）」接起来，
 * 并暴露一个单例给 UI 使用。整个应用只有这里知道 WebSocket 的存在。
 */
import { CloversClient } from '@/services/client';
import { useChat, markMessageStatus, setTransport } from './chat';
import { useConnection } from './connection';
import { useSession } from './session';
import { toast } from './ui';
import { useSettings } from './settings';
import { useBackground } from './background';

let client: CloversClient | null = null;
let installed = false;

export function getClient(): CloversClient | null {
    return client;
}

/** 启动后端连接（只执行一次） */
export function startApp(): void {
    if (installed) return;
    installed = true;

    client = new CloversClient({
        onMessage: (message) => {
            if (message.type === 'system') {
                useChat.getState().handleSystemMessage(message);
            } else {
                useChat.getState().handleUserMessage(message);
            }
        },
        onStateChange: (state) => {
            const previous = useConnection.getState().state;
            useConnection.getState().setState(state);
            if (previous === 'connecting' && state === 'online') {
                toast.success('已连接到 Clovers 终端');
            }
            if (previous === 'online' && state === 'offline') {
                toast.warning('与终端断开连接', '正在自动重连…');
            }
        },
    });

    // chat store 通过这里把消息真正发出去、以及按 ID 查消息
    setTransport({
        send: (payload, localId, groupId) => {
            const ok = client?.send(payload) ?? false;
            if (!ok) {
                // 离线：消息进了发送队列，稍后重连会自动补发。
                // 气泡先标成失败态提示用户，等回显到了会被替换成正式记录。
                markMessageStatus(groupId, localId, 'failed');
                toast.warning('当前离线，消息已排队', '恢复连接后会自动发送');
            }
            // 在线时不急着标 sent —— 交给服务端回显来确认
            return ok;
        },
        fetchMessage: (messageId) => client?.fetchMessage(messageId) ?? Promise.resolve(null),
    });

    client.connect();
}

export function reconnect(): void {
    client?.reconnectNow();
}

/** 用户开启桌面通知时申请权限 */
export async function ensureNotificationPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
        toast.error('当前浏览器不支持桌面通知');
        return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
        toast.error('通知权限已被拒绝', '请在浏览器地址栏的站点设置里重新允许');
        return false;
    }
    const result = await Notification.requestPermission();
    return result === 'granted';
}

/** 供命令面板 / 设置面板使用的统一动作入口 */
export const actions = {
    selectGroup(groupId: string) {
        const session = useSession.getState();
        if (session.currentGroupId === groupId) return;
        session.selectGroup(groupId);
    },
    async selectGroupAndLoad(groupId: string) {
        actions.selectGroup(groupId);
        await useChat.getState().ensureLoaded(groupId);
        useChat.getState().markRead(groupId);
    },
    selectUser(userId: string) {
        useSession.getState().selectUser(userId);
    },
    async clearCurrentGroup() {
        const session = useSession.getState();
        const groupId = session.currentGroupId;
        await useChat.getState().clearGroup(groupId);
        useChat.getState().localSystem(groupId, '聊天记录已清空');
    },
    async setNotify(enabled: boolean) {
        if (enabled) {
            const granted = await ensureNotificationPermission();
            useSettings.getState().setPreference('notify', granted);
            if (granted) toast.success('已开启桌面通知');
            return;
        }
        useSettings.getState().setPreference('notify', false);
    },

    /** 换背景图并（可选）跟着提取主题色 */
    async setBackgroundImage(file: File) {
        await useBackground.getState().apply(file);
    },
    async removeBackgroundImage() {
        await useBackground.getState().remove();
    },
    /** 从当前背景图重新提取主题色 */
    async extractThemeFromBackground(): Promise<string | null> {
        const state = useBackground.getState();
        if (!state.url) {
            toast.warning('还没有设置背景图片');
            return null;
        }
        await state.reExtract();
        const hex = useBackground.getState().extractedHex;
        useSettings.getState().setAppearance({
            palette: 'auto',
            autoHue: useSettings.getState().appearance.autoHue,
        });
        if (hex) toast.success('已从背景图提取主题色');
        return hex;
    },
};
