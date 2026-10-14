/**
 * db.ts —— IndexedDB 连接与表结构的唯一出处。
 *
 * 数据库沿用旧名 ChatAppDB，版本演进：
 *   v1  histories —— 每个会话一段 HTML 快照（旧版遗留）
 *   v2  messages  —— 每条消息一条记录，带 [groupId] 索引
 *   v3  assets    —— 用户上传的本地资源（目前只有自定义背景图）
 *
 * 升级不会删除任何旧表；histories 只有在该会话被成功迁移之后才会清掉。
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { FeedItem } from '@/types/protocol';

export const DB_NAME = 'ChatAppDB';
export const DB_VERSION = 3;

export const STORE_MESSAGES = 'messages';
export const STORE_LEGACY = 'histories';
export const STORE_ASSETS = 'assets';

export type StoredFeedItem = FeedItem & { id: string; groupId: string; time: number };

export interface CloversDB {
    [STORE_MESSAGES]: {
        key: string;
        value: StoredFeedItem;
        indexes: { 'by-group': string };
    };
    [STORE_LEGACY]: {
        key: string;
        value: string[];
    };
    [STORE_ASSETS]: {
        key: string;
        value: { key: string; blob: Blob; updatedAt: number };
    };
}

let dbPromise: Promise<IDBPDatabase<CloversDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<CloversDB>> {
    if (!dbPromise) {
        dbPromise = openDB<CloversDB>(DB_NAME, DB_VERSION, {
            upgrade(database) {
                if (!database.objectStoreNames.contains(STORE_LEGACY)) {
                    database.createObjectStore(STORE_LEGACY);
                }
                if (!database.objectStoreNames.contains(STORE_MESSAGES)) {
                    const store = database.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
                    store.createIndex('by-group', 'groupId');
                }
                if (!database.objectStoreNames.contains(STORE_ASSETS)) {
                    database.createObjectStore(STORE_ASSETS, { keyPath: 'key' });
                }
            },
        });
    }
    return dbPromise;
}

/**
 * 每个会话一条写入队列，保证同一时刻只有一个写事务，避免相互覆盖。
 * history.ts 与 assets.ts 都通过它串行化写操作。
 */
const writeQueues = new Map<string, Promise<unknown>>();

export function enqueueWrite<T>(key: string, job: () => Promise<T>): Promise<T> {
    const prev = writeQueues.get(key) ?? Promise.resolve();
    const next = prev.then(job, job);
    writeQueues.set(
        key,
        next.catch(() => undefined),
    );
    return next;
}
