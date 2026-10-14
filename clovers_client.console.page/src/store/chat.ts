/**
 * chat.ts —— 消息流、未读、草稿摘要。
 *
 * 数据流：
 *   WebSocket -> bridge.ts -> chatStore.ingest()
 *                              ├─ 更新内存 feed（React 立即重渲染）
 *                              ├─ 写 IndexedDB（historyStore）
 *                              ├─ 更新未读计数 / 列表摘要
 *                              └─ 触发桌面通知 + 提示音
 *
 * 历史记录只在会话第一次被打开时从 IndexedDB 读一次，之后全靠内存，
 * 因此切换会话是瞬时的。
 *
 * ── 关于「自己发的消息」──────────────────────────────────────────────
 * 发送流程是乐观更新 + 回显对账：
 *   1. send() 立刻在列表末尾插入一条 status='sending' 的本地记录，
 *      并生成一个 echo 标记（随机字符串）随消息一起发给服务端；
 *   2. 服务端把这条消息广播回来时会带上同一个 echo；
 *   3. ingest() 发现 echo 能在 pending 表里对上号，就删掉本地占位记录、
 *      换成服务端那条（拿到真正的 messageId），'sending' 标记随之消失；
 *   4. 万一服务端不支持 echo，超时后也会把状态拨回 'sent'（但保留映射，
 *      以便迟到很久的回显仍然不会造成重复气泡）。
 */
import { create } from 'zustand';
import type {
    ChatRecord,
    ClientUserMessage,
    FeedItem,
    GroupInfo,
    ServerMessage,
    ServerUserMessage,
    SystemRecord,
} from '@/types/protocol';
import { historyStore } from '@/services/history';
import { currentGroup, currentUser, useSession } from './session';
import { toast } from './ui';
import { uid } from '@/lib/id';
import { summarize } from '@/lib/format';
import { useSettings } from './settings';

export interface GroupSummary {
    text: string;
    time: number;
    senderName: string;
}

/** 引用卡片要显示的内容 */
export interface QuotePreview {
    name: string;
    text: string;
}

/** 本地占位消息与 echo 的对应关系 */
interface PendingEntry {
    groupId: string;
    localId: string;
    /** 已经因为超时被标记成 sent，但映射要留着继续防重复 */
    settled?: boolean;
}

type UserFeedItem = Extract<FeedItem, { kind: 'user' }>;

const ECHO_TIMEOUT = 12000;

interface ChatState {
    feeds: Record<string, FeedItem[]>;
    loading: Record<string, boolean>;
    loaded: Record<string, boolean>;
    unread: Record<string, number>;
    summaries: Record<string, GroupSummary>;
    /** 当前会话中第一条未读消息的 id，用于渲染「未读分隔线」 */
    unreadAnchor: Record<string, string | null>;
    /** echo -> 本地占位消息，用于把服务端回显和本地气泡对上号 */
    pending: Record<string, PendingEntry>;
    /** 引用消息的缓存（本地历史里找不到时通过 /message/{id} 拉取） */
    quotes: Record<string, QuotePreview | null>;

    ensureLoaded: (groupId: string) => Promise<void>;
    /** 处理一条来自服务端的消息 */
    ingest: (message: ServerMessage) => void;
    localSystem: (groupId: string, text: string) => void;
    send: (text: string, images: string[], at: string[], reply: string | null) => void;
    markRead: (groupId: string) => void;
    removeMessage: (groupId: string, messageId: string) => Promise<void>;
    clearGroup: (groupId: string) => Promise<void>;
    clearAll: () => Promise<void>;
    /** 补全引用消息的内容（本地没有时走接口查） */
    ensureQuote: (messageId: string) => Promise<void>;
}

/** 把服务端用户消息转成本地记录 */
function toRecord(message: ServerUserMessage, selfId: string): UserFeedItem {
    return {
        kind: 'user',
        id: message.messageId ?? uid('msg'),
        groupId: message.groupId,
        senderId: message.senderId,
        senderName: message.senderName || message.senderId,
        avatar: message.avatar ?? '',
        permission: message.permission ?? 'Member',
        text: message.text ?? '',
        images: Array.isArray(message.images) ? message.images : [],
        at: Array.isArray(message.at) ? message.at : [],
        reply: message.reply ?? null,
        time: Date.now(),
        self: message.senderId === selfId,
        status: 'sent',
        echo: message.echo,
    };
}

/** 保证同一会话内时间戳单调递增，避免「先发的排后面」 */
function monotonic(feed: FeedItem[] | undefined, time: number): number {
    const last = feed?.at(-1)?.time;
    return last !== undefined && last >= time ? last + 1 : time;
}

function playBeep(): void {
    try {
        const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        osc.onended = () => void ctx.close();
    } catch {
        /* 自动播放策略拦下来就静默失败 */
    }
}

function notifyDesktop(title: string, body: string): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
        const n = new Notification(title, { body, tag: 'clovers-message', silent: true });
        n.onclick = () => {
            window.focus();
            n.close();
        };
    } catch {
        /* ignore */
    }
}

/**
 * 合并「从 IndexedDB 读出来的历史」和「读的过程中已经实时收到的消息」。
 *
 * 这是一个真实存在的竞态：打开会话要读一次 IndexedDB（异步），
 * 而 WebSocket 上的新消息可能在这期间就到了内存里。
 * 直接覆盖会让先到的实时消息凭空消失，所以这里按 id 去重后按时间排序。
 */
function mergeFeed(persisted: FeedItem[], live: FeedItem[]): FeedItem[] {
    if (live.length === 0) return persisted;
    const byId = new Map<string, FeedItem>();
    persisted.forEach((item) => byId.set(item.id, item));
    live.forEach((item) => byId.set(item.id, item));
    return [...byId.values()].sort((a, b) => a.time - b.time);
}

function summarizeItem(item: FeedItem): string {
    return item.kind === 'system'
        ? summarize(item.text)
        : summarize(item.text || (item.images.length ? '[图片]' : ''));
}

/** 超时兜底：服务端没有回显时把气泡从「发送中」放行 */
const echoTimers = new Map<string, number>();

function clearEchoTimer(echo: string) {
    const timer = echoTimers.get(echo);
    if (timer !== undefined) {
        window.clearTimeout(timer);
        echoTimers.delete(echo);
    }
}

/**
 * 「内容指纹」：服务端不支持 echo 时用来认领本地占位气泡。
 * 只比对影响展示的字段，顺序无关的（@列表）先排序再拼。
 */
function contentKey(item: {
    text: string;
    images: string[];
    at: string[];
    reply: string | null;
}): string {
    return [item.text, [...item.images].sort().join(','), [...item.at].sort().join(','), item.reply ?? ''].join(
        '\u0000',
    );
}

/**
 * 服务端没有把 echo 带回来时的兜底匹配。
 *
 * 为什么需要它：老后端只是把消息原样广播，没有 echo 就无法区分
 * 「这是我刚发的那条」和「另一台设备恰好发了同样内容」。
 *
 * 做法：在同一个会话里找**内容完全相同**、且仍在 `pending` 里的本地占位气泡，
 * 取最早的一条认领。这样连续发两条一样的消息也能按先后顺序一一对上，
 * 而不会合并成一条。
 */
function findPendingByContent(
    state: ChatState,
    record: UserFeedItem,
): { entry: PendingEntry; echo: string } | null {
    const key = contentKey(record);
    const candidates: { entry: PendingEntry; echo: string; time: number }[] = [];

    for (const [echo, entry] of Object.entries(state.pending)) {
        if (entry.groupId !== record.groupId) continue;
        const local = (state.feeds[entry.groupId] ?? []).find(
            (item): item is UserFeedItem => item.kind === 'user' && item.id === entry.localId,
        );
        if (!local) continue;
        if (contentKey(local) !== key) continue;
        candidates.push({ entry, echo, time: local.time });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.time - b.time);
    return { entry: candidates[0].entry, echo: candidates[0].echo };
}

export const useChat = create<ChatState>((set, get) => ({
    feeds: {},
    loading: {},
    loaded: {},
    unread: {},
    summaries: {},
    unreadAnchor: {},
    pending: {},
    quotes: {},

    ensureLoaded: async (groupId) => {
        if (get().loaded[groupId] || get().loading[groupId]) return;
        set((s) => ({ loading: { ...s.loading, [groupId]: true } }));

        // 旧版 HTML 快照先迁移成结构化消息（只做一次）
        const migrated = await historyStore.migrateLegacy(groupId);
        const items = await historyStore.load(groupId);

        set((s) => {
            // 关键：与读盘期间已经到达的实时消息合并，而不是直接覆盖
            const feed = mergeFeed(items, s.feeds[groupId] ?? []);
            const summaries = { ...s.summaries };
            const last = feed.at(-1);
            if (last) {
                summaries[groupId] = {
                    text: summarizeItem(last),
                    time: last.time,
                    senderName: last.kind === 'system' ? '系统' : last.senderName,
                };
            }
            return {
                feeds: { ...s.feeds, [groupId]: feed },
                loading: { ...s.loading, [groupId]: false },
                loaded: { ...s.loaded, [groupId]: true },
                summaries,
            };
        });

        if (migrated > 0) {
            toast.info(
                `已迁移 ${migrated} 条旧版聊天记录`,
                '旧记录的原始排版无法完全还原，但内容都已保留',
            );
        }
    },

    ingest: (message) => {
        if (message.type === 'system') {
            const [command, groupId, payload] = message.data;
            if (command === 'title') {
                // 旧版语义：payload 才是新标题
                useSession.getState().updateGroup(groupId, { groupName: payload });
                useSession.getState().learnGroup(groupId, payload);
                return;
            }
            get().localSystem(groupId, payload);
            return;
        }

        const selfId = currentUser().userId;
        const record = toRecord(message, selfId);

        // 更新「认识的人」目录，供 @提及 使用
        useSession.getState().learnUser(record.senderId, record.senderName, record.avatar);
        useSession.getState().learnGroup(record.groupId, message.groupName, message.groupAvatar);

        // 会话可能还不在列表里（别人新建的会话）
        const known = useSession.getState().groups.find((g) => g.groupId === record.groupId);
        if (!known) {
            const group: GroupInfo = {
                groupId: record.groupId,
                groupName: message.groupName || record.groupId,
                avatar: message.groupAvatar || '',
                flag: true,
            };
            useSession.getState().ensureGroup(group);
        } else if (
            (message.groupName && message.groupName !== known.groupName) ||
            (message.groupAvatar && message.groupAvatar !== known.avatar)
        ) {
            useSession.getState().updateGroup(record.groupId, {
                groupName: message.groupName || known.groupName,
                avatar: message.groupAvatar || known.avatar,
            });
        }

        // ── 回显对账：这条广播是不是「我刚发的那条」？ ──
        // 先按 echo 精确匹配；服务端没回传 echo 时，退化成按内容匹配本地占位气泡。
        let pendingEntry = record.echo ? get().pending[record.echo] : undefined;
        let pendingEcho = record.echo;
        if (record.echo) clearEchoTimer(record.echo);

        if (!pendingEntry && record.self) {
            const fallback = findPendingByContent(get(), record);
            if (fallback) {
                pendingEntry = fallback.entry;
                pendingEcho = fallback.echo;
            }
        }

        const activeGroupId = currentGroup().groupId;
        const isActive = record.groupId === activeGroupId;

        if (pendingEntry) {
            // 用服务端这条替换掉本地占位记录，这样 messageId 才是真的，
            // 别人回复/引用它时才能通过 /message/{id} 查到。
            const time = monotonic(get().feeds[pendingEntry.groupId], record.time);
            const stamped: UserFeedItem = { ...record, time, self: true, status: 'sent' };

            set((s) => {
                const feed = s.feeds[pendingEntry!.groupId] ?? [];
                const next = feed.filter(
                    (item) => !(item.kind === 'user' && item.id === pendingEntry!.localId),
                );
                next.push(stamped);
                next.sort((a, b) => a.time - b.time);
                const pending = { ...s.pending };
                if (pendingEcho) delete pending[pendingEcho];
                return {
                    feeds: { ...s.feeds, [pendingEntry!.groupId]: next },
                    summaries: {
                        ...s.summaries,
                        [pendingEntry!.groupId]: {
                            text: summarizeItem(stamped),
                            time,
                            senderName: stamped.senderName,
                        },
                    },
                    pending,
                };
            });

            // 本地占位那条已经从库里删掉，换成服务端的正式记录
            void historyStore.remove(pendingEntry.groupId, pendingEntry.localId);
            void historyStore.append(stamped);
            return;
        }
        // ── 普通消息 ──
        // 时间戳在进入 set 之前先算好，保证内存与落库用的是同一个值
        const time = monotonic(get().feeds[record.groupId], record.time);
        const stamped: UserFeedItem = { ...record, time };

        let duplicated = false;
        set((s) => {
            const feed = s.feeds[record.groupId] ?? [];
            if (feed.some((item) => item.id === stamped.id)) {
                duplicated = true;
                return {};
            }
            const feeds = { ...s.feeds, [record.groupId]: [...feed, stamped] };
            const summaries = {
                ...s.summaries,
                [record.groupId]: {
                    text: summarizeItem(stamped),
                    time,
                    senderName: record.senderName,
                },
            };

            if (isActive || record.self) {
                return { feeds, summaries };
            }
            const wasZero = (s.unread[record.groupId] ?? 0) === 0;
            return {
                feeds,
                summaries,
                unread: { ...s.unread, [record.groupId]: (s.unread[record.groupId] ?? 0) + 1 },
                unreadAnchor: wasZero
                    ? { ...s.unreadAnchor, [record.groupId]: stamped.id }
                    : s.unreadAnchor,
            };
        });

        if (duplicated) return;

        void historyStore.append(stamped);

        const prefs = useSettings.getState().preferences;
        if (!isActive && !record.self) {
            const groupName =
                useSession.getState().knownGroups[record.groupId]?.name ?? record.groupId;
            if (prefs.notify) {
                notifyDesktop(
                    `${record.senderName} · ${groupName}`,
                    summarize(record.text || '[图片]', 80),
                );
            }
            if (prefs.soundOnMessage) playBeep();
        }
    },

    localSystem: (groupId, text) => {
        const record: SystemRecord = { id: uid('sys'), groupId, time: Date.now(), text };
        set((s) => {
            const feed = s.feeds[groupId] ?? [];
            const time = monotonic(feed, record.time);
            return {
                feeds: { ...s.feeds, [groupId]: [...feed, { kind: 'system', ...record, time }] },
                summaries: {
                    ...s.summaries,
                    [groupId]: { text: summarize(text), time, senderName: '系统' },
                },
            };
        });
        void historyStore.append({ kind: 'system', ...record });
    },

    send: (text, images, at, reply) => {
        const user = currentUser();
        const group = currentGroup();
        const echo = uid('echo');
        const localId = uid('local');

        const record: UserFeedItem = {
            kind: 'user',
            id: localId,
            groupId: group.groupId,
            senderId: user.userId,
            senderName: user.userName,
            avatar: user.avatar,
            permission: user.permission,
            text,
            images,
            at,
            reply,
            time: Date.now(),
            self: true,
            status: 'sending',
            echo,
        };

        const time = monotonic(get().feeds[group.groupId], record.time);
        const stamped: UserFeedItem = { ...record, time };

        set((s) => ({
            feeds: { ...s.feeds, [group.groupId]: [...(s.feeds[group.groupId] ?? []), stamped] },
            summaries: {
                ...s.summaries,
                [group.groupId]: {
                    text: summarizeItem(stamped),
                    time,
                    senderName: user.userName,
                },
            },
            pending: { ...s.pending, [echo]: { groupId: group.groupId, localId } },
        }));

        void historyStore.append(stamped);

        const payload: ClientUserMessage = {
            type: 'user',
            text,
            images,
            at,
            reply,
            senderId: user.userId,
            senderName: user.userName,
            avatar: user.avatar,
            groupId: group.groupId,
            groupName: group.groupName,
            groupAvatar: group.avatar,
            permission: user.permission,
            echo,
        };

        transport?.send(payload, localId, group.groupId);

        // 服务端不支持 echo 时的兜底：超时就把「发送中」放行。
        // 注意 pending 映射不删，迟到的回显仍然能对账，不会多出一个气泡。
        clearEchoTimer(echo);
        echoTimers.set(
            echo,
            window.setTimeout(() => {
                echoTimers.delete(echo);
                const entry = useChat.getState().pending[echo];
                if (!entry) return;
                markMessageStatus(entry.groupId, entry.localId, 'sent');
                useChat.setState((s) => ({
                    pending: { ...s.pending, [echo]: { ...entry, settled: true } },
                }));
            }, ECHO_TIMEOUT),
        );
    },

    markRead: (groupId) =>
        set((s) => ({
            unread: { ...s.unread, [groupId]: 0 },
            unreadAnchor: { ...s.unreadAnchor, [groupId]: null },
        })),

    removeMessage: async (groupId, messageId) => {
        set((s) => ({
            feeds: {
                ...s.feeds,
                [groupId]: (s.feeds[groupId] ?? []).filter((m) => m.id !== messageId),
            },
        }));
        await historyStore.remove(groupId, messageId);
    },

    clearGroup: async (groupId) => {
        set((s) => ({
            feeds: { ...s.feeds, [groupId]: [] },
            summaries: { ...s.summaries, [groupId]: { text: '', time: 0, senderName: '' } },
            unread: { ...s.unread, [groupId]: 0 },
            unreadAnchor: { ...s.unreadAnchor, [groupId]: null },
        }));
        await historyStore.clear(groupId);
    },

    clearAll: async () => {
        set({ feeds: {}, summaries: {}, unread: {}, unreadAnchor: {}, quotes: {} });
        await historyStore.clearAll();
    },

    ensureQuote: async (messageId) => {
        if (!messageId) return;
        const cached = get().quotes[messageId];
        if (cached !== undefined) return;

        // 先看本地历史里有没有，避免无谓的请求
        const local = Object.values(get().feeds)
            .flat()
            .find((item): item is UserFeedItem => item.kind === 'user' && item.id === messageId);
        if (local) {
            set((s) => ({
                quotes: {
                    ...s.quotes,
                    [messageId]: { name: local.senderName, text: summarize(local.text || '[图片]', 120) },
                },
            }));
            return;
        }

        const fetched = await transport?.fetchMessage(messageId);
        set((s) => ({
            quotes: {
                ...s.quotes,
                [messageId]: fetched
                    ? {
                          name: fetched.senderName || fetched.senderId,
                          text: summarize(fetched.text || '[图片]', 120),
                      }
                    : null, // null 表示「确实查不到」
            },
        }));
    },
}));

/* ------------------------------ 传输层注入 ------------------------------ */

interface ChatTransport {
    /** 发送；返回 false 表示当前离线、消息进了队列 */
    send: (payload: ClientUserMessage, localId: string, groupId: string) => boolean;
    /** 按 ID 查一条消息，用于补全引用内容 */
    fetchMessage: (messageId: string) => Promise<ServerUserMessage | null>;
}

let transport: ChatTransport | null = null;

/**
 * bridge.ts 在启动时注入真正的网络实现。
 * 这样 chat store 不依赖 services/client，方便单测与离线演示。
 */
export function setTransport(next: ChatTransport | null): void {
    transport = next;
}

/** 传输层回调：更新某条本地消息的状态 */
export function markMessageStatus(
    groupId: string,
    localId: string,
    status: ChatRecord['status'],
): void {
    useChat.setState((s) => ({
        feeds: {
            ...s.feeds,
            [groupId]: (s.feeds[groupId] ?? []).map((m) =>
                m.kind === 'user' && m.id === localId ? { ...m, status } : m,
            ),
        },
    }));
}

/** 未读总数，用于标题与 favicon 角标 */
export function totalUnread(unread: Record<string, number>): number {
    return Object.values(unread).reduce((sum, n) => sum + n, 0);
}
