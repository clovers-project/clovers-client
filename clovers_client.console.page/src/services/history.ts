/**
 * history.ts —— 会话历史的本地持久化
 *
 * v2 起改为结构化存储：每条消息一条记录，带 groupId 索引。
 * 旧版（v1）的 HTML 快照会在打开会话时由 migrateLegacy() 尽力迁移。
 * 数据库连接与表结构见 ./db.ts。
 */
import type { FeedItem } from '@/types/protocol';
import { STORE_LEGACY, STORE_MESSAGES, enqueueWrite, getDB, type StoredFeedItem } from './db';
import { parseLegacyHistory } from './legacy';

const MIGRATED_FLAG = 'clovers.legacyMigrated';

export const historyStore = {
    /** 读取某个会话的全部消息（按时间升序） */
    async load(groupId: string): Promise<FeedItem[]> {
        try {
            const db = await getDB();
            const rows = (await db.getAllFromIndex(
                STORE_MESSAGES,
                'by-group',
                groupId,
            )) as StoredFeedItem[];
            return rows.sort((a, b) => a.time - b.time);
        } catch (err) {
            console.error('[history] 读取失败', err);
            return [];
        }
    },

    /** 追加一条（写队列内串行执行） */
    append(item: FeedItem): Promise<void> {
        return enqueueWrite(item.groupId, async () => {
            try {
                const db = await getDB();
                await db.put(STORE_MESSAGES, item as StoredFeedItem);
            } catch (err) {
                console.error('[history] 写入失败', err);
            }
        });
    },

    /** 批量写入（迁移时用） */
    appendMany(groupId: string, items: FeedItem[]): Promise<void> {
        if (items.length === 0) return Promise.resolve();
        return enqueueWrite(groupId, async () => {
            try {
                const db = await getDB();
                const tx = db.transaction(STORE_MESSAGES, 'readwrite');
                await Promise.all([
                    ...items.map((item) => tx.store.put(item as StoredFeedItem)),
                    tx.done,
                ]);
            } catch (err) {
                console.error('[history] 批量写入失败', err);
            }
        });
    },

    async remove(groupId: string, id: string): Promise<void> {
        return enqueueWrite(groupId, async () => {
            try {
                const db = await getDB();
                await db.delete(STORE_MESSAGES, id);
            } catch (err) {
                console.error('[history] 删除失败', err);
            }
        });
    },

    async clear(groupId: string): Promise<void> {
        return enqueueWrite(groupId, async () => {
            try {
                const db = await getDB();
                const keys = await db.getAllKeysFromIndex(STORE_MESSAGES, 'by-group', groupId);
                const tx = db.transaction(STORE_MESSAGES, 'readwrite');
                await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
                await db.delete(STORE_LEGACY, groupId);
            } catch (err) {
                console.error('[history] 清空失败', err);
            }
        });
    },

    async clearAll(): Promise<void> {
        try {
            const db = await getDB();
            await db.clear(STORE_MESSAGES);
            await db.clear(STORE_LEGACY);
        } catch (err) {
            console.error('[history] 全量清空失败', err);
        }
    },

    /**
     * 旧版 HTML 快照迁移。
     * @returns 迁移出来的消息条数（0 表示没有旧数据或解析不出内容）
     */
    async migrateLegacy(groupId: string): Promise<number> {
        try {
            const db = await getDB();
            const raw = (await db.get(STORE_LEGACY, groupId)) as string[] | undefined;
            if (!raw || raw.length === 0) return 0;

            const items = parseLegacyHistory(raw.join('\n'), groupId);
            if (items.length > 0) {
                await this.appendMany(groupId, items);
                await db.delete(STORE_LEGACY, groupId);
                try {
                    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
                } catch {
                    /* ignore */
                }
            }
            return items.length;
        } catch (err) {
            console.error('[history] 迁移失败', err);
            return 0;
        }
    },

    /** 是否存在尚未迁移的旧数据 */
    async hasLegacy(groupId: string): Promise<boolean> {
        try {
            const db = await getDB();
            const raw = await db.get(STORE_LEGACY, groupId);
            return Array.isArray(raw) && raw.length > 0;
        } catch {
            return false;
        }
    },

    /** 列出所有存在历史记录的会话 ID（用于导出全部/统计） */
    async groups(): Promise<string[]> {
        try {
            const db = await getDB();
            const keys = await db.getAllKeysFromIndex(STORE_MESSAGES, 'by-group');
            return Array.from(new Set(keys as string[]));
        } catch {
            return [];
        }
    },
};
