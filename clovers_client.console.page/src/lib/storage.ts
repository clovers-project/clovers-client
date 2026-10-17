/**
 * storage.ts —— localStorage 的类型化封装。
 *
 * 这里刻意保留旧版的键名（userId / groupId / userList / groupList / atbot），
 * 这样从旧版本升级上来的用户不会丢失身份与列表数据。
 * 新增的键统一带 `clovers.` 前缀。
 */

export const KEYS = {
    userId: 'clovers.userId',
    groupId: 'clovers.groupId',
    userList: 'clovers.userList',
    groupList: 'clovers.groupList',
    atbot: 'clovers.atbot',
    lastMessageId: 'clovers.lastMessageId',
    appearance: 'clovers.appearance',
    preferences: 'clovers.preferences',
    sidebarWidth: 'clovers.sidebarWidth',
    drafts: 'clovers.drafts',
    authToken: 'clovers.authToken',
} as const;

export function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        // 数据损坏时直接丢弃，避免整个应用起不来
        try {
            localStorage.removeItem(key);
        } catch {
            /* ignore */
        }
        return fallback;
    }
}

export function writeJSON(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.warn(`[storage] 写入 ${key} 失败`, err);
    }
}

export function readText(key: string, fallback: string): string {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeText(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch (err) {
        console.warn(`[storage] 写入 ${key} 失败`, err);
    }
}
