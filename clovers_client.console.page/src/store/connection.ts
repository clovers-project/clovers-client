/**
 * connection.ts —— 与后端连接的状态（连接中 / 在线 / 离线）
 */
import { create } from 'zustand';
import type { ConnectionState } from '@/types/protocol';

interface ConnectionStore {
    state: ConnectionState;
    /** 最近一次进入在线状态的时间 */
    onlineSince: number | null;
    setState: (state: ConnectionState) => void;
}

export const useConnection = create<ConnectionStore>((set) => ({
    state: 'connecting',
    onlineSince: null,
    setState: (state) =>
        set((s) => ({
            state,
            onlineSince: state === 'online' && s.state !== 'online' ? Date.now() : s.onlineSince,
        })),
}));

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
    connecting: '连接中…',
    online: '已连接',
    offline: '已断开',
};
