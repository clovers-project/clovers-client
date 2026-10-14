/**
 * assets.ts —— 用户本地资源的持久化（目前只有「自定义背景图」）。
 *
 * 为什么不用 localStorage：背景图动辄几 MB，localStorage 只有 ~5MB 且只能存字符串。
 * IndexedDB 可以直接存 Blob，读取时再转成 object URL，内存占用也更友好。
 */
import { STORE_ASSETS, enqueueWrite, getDB } from './db';

export const ASSET_BACKGROUND = 'background-image';

export const assetsStore = {
    async put(key: string, blob: Blob): Promise<void> {
        return enqueueWrite('assets', async () => {
            const db = await getDB();
            await db.put(STORE_ASSETS, { key, blob, updatedAt: Date.now() });
        });
    },

    async get(key: string): Promise<Blob | null> {
        try {
            const db = await getDB();
            const row = await db.get(STORE_ASSETS, key);
            return row?.blob ?? null;
        } catch (err) {
            console.error('[assets] 读取失败', err);
            return null;
        }
    },

    async remove(key: string): Promise<void> {
        return enqueueWrite('assets', async () => {
            const db = await getDB();
            await db.delete(STORE_ASSETS, key);
        });
    },

    async keys(): Promise<string[]> {
        try {
            const db = await getDB();
            return (await db.getAllKeys(STORE_ASSETS)) as string[];
        } catch {
            return [];
        }
    },
};
