/**
 * session.ts —— 身份与会话列表。
 *
 * 沿用了旧版 CloversManager 的数据语义和 localStorage 键名，
 * 所以从旧版本升级的用户不会丢失自己的身份与列表：
 *   userId / groupId      —— 当前选中的身份、会话
 *   userList / groupList  —— 列表本体
 * 「当前项」永远被顶到列表第一个，和旧版 moveTop 行为一致。
 */
import { create } from 'zustand';
import type { GroupInfo, Permission, UserInfo } from '@/types/protocol';
import { LEGACY_KEYS, readJSON, readText, writeJSON, writeText } from '@/lib/storage';

/*
 * defaultUser / defaultGroup 做了记忆化：
 * 它们会被 zustand 的 selector 调用，如果每次返回新对象会让
 * useSyncExternalStore 认为快照一直在变。同一 id 复用同一引用即可。
 */
const userCache = new Map<string, UserInfo>();
const groupCache = new Map<string, GroupInfo>();

const defaultUser = (userId: string): UserInfo => {
    let cached = userCache.get(userId);
    if (!cached) {
        cached = {
            userId,
            userName: userId === '1' ? '用户' : `用户 ${userId.slice(-4)}`,
            avatar: '',
            permission: 'Member',
        };
        userCache.set(userId, cached);
    }
    return cached;
};

const defaultGroup = (groupId: string): GroupInfo => {
    let cached = groupCache.get(groupId);
    if (!cached) {
        cached = {
            groupId,
            groupName: groupId === '1' ? '默认会话' : `会话 ${groupId.slice(-4)}`,
            avatar: '',
            flag: true,
        };
        groupCache.set(groupId, cached);
    }
    return cached;
};

/** 从后端消息里学到的人物目录（相当于旧版的 UserStubs / GroupStubs） */
export interface KnownPerson {
    name: string;
    avatar: string;
}

interface SessionState {
    users: UserInfo[];
    groups: GroupInfo[];
    currentUserId: string;
    currentGroupId: string;
    /** userId -> 名称/头像，用于 @提及 展示与自动补全 */
    knownUsers: Record<string, KnownPerson>;
    /** groupId -> 名称/头像 */
    knownGroups: Record<string, KnownPerson>;

    selectUser: (userId: string) => void;
    selectGroup: (groupId: string) => void;

    upsertUser: (user: UserInfo) => void;
    updateUser: (userId: string, patch: Partial<UserInfo>) => void;
    removeUser: (userId: string) => void;
    clearUsers: () => void;
    addBlankUser: () => UserInfo;

    updateGroup: (groupId: string, patch: Partial<GroupInfo>) => void;
    /** 改会话 ID：同时更新当前选中项与持久化数据 */
    renameGroup: (oldId: string, newId: string, patch: Partial<GroupInfo>) => void;
    removeGroup: (groupId: string) => void;
    /** 收到某会话的消息时确保它存在于列表（旧版 appendGroup 的替代） */
    ensureGroup: (group: GroupInfo) => GroupInfo;
    addBlankGroup: () => GroupInfo;

    learnUser: (userId: string, name: string, avatar?: string) => void;
    learnGroup: (groupId: string, name: string, avatar?: string) => void;
}

function loadList<T>(key: string): T[] {
    const value = readJSON<T[]>(key, []);
    return Array.isArray(value) ? value : [];
}

/** 把指定项移到数组开头（等价旧版 moveTop） */
function moveTop<T>(list: T[], match: (item: T) => boolean): T[] {
    const index = list.findIndex(match);
    if (index <= 0) return list;
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    return next;
}

function ensurePresent<T>(list: T[], id: string, read: (item: T) => string, create: (id: string) => T): T[] {
    if (list.some((item) => read(item) === id)) return list;
    return [create(id), ...list];
}

const initialUsers = loadList<UserInfo>(LEGACY_KEYS.userList);
const initialGroups = loadList<GroupInfo>(LEGACY_KEYS.groupList);
const initialUserId = readText(LEGACY_KEYS.userId, '1');
const initialGroupId = readText(LEGACY_KEYS.groupId, '1');

export const useSession = create<SessionState>((set, get) => ({
    users: ensurePresent(initialUsers, initialUserId, (u) => u.userId, defaultUser),
    groups: ensurePresent(initialGroups, initialGroupId, (g) => g.groupId, defaultGroup),
    currentUserId: initialUserId,
    currentGroupId: initialGroupId,
    knownUsers: {},
    knownGroups: {},

    selectUser: (userId) => {
        const users = moveTop(
            ensurePresent(get().users, userId, (u) => u.userId, defaultUser),
            (u) => u.userId === userId,
        );
        set({ users, currentUserId: userId });
        writeText(LEGACY_KEYS.userId, userId);
        writeJSON(LEGACY_KEYS.userList, users);
    },

    selectGroup: (groupId) => {
        const groups = moveTop(
            ensurePresent(get().groups, groupId, (g) => g.groupId, defaultGroup),
            (g) => g.groupId === groupId,
        );
        set({ groups, currentGroupId: groupId });
        writeText(LEGACY_KEYS.groupId, groupId);
        writeJSON(LEGACY_KEYS.groupList, groups);
    },

    upsertUser: (user) => {
        const users = get().users.slice();
        const index = users.findIndex((u) => u.userId === user.userId);
        if (index === -1) users.unshift(user);
        else users[index] = { ...users[index], ...user };
        set({ users });
        writeJSON(LEGACY_KEYS.userList, users);
    },

    updateUser: (userId, patch) => {
        const users = get().users.map((u) => (u.userId === userId ? { ...u, ...patch } : u));
        set({ users });
        writeJSON(LEGACY_KEYS.userList, users);
    },

    removeUser: (userId) => {
        const remaining = get().users.filter((u) => u.userId !== userId);
        set({ users: remaining });
        writeJSON(LEGACY_KEYS.userList, remaining);
        if (get().currentUserId === userId) {
            get().selectUser(remaining[0]?.userId ?? '1');
        }
    },

    clearUsers: () => {
        const keep = resolveCurrentUser(get());
        const users = [keep];
        set({ users });
        writeJSON(LEGACY_KEYS.userList, users);
    },

    addBlankUser: () => {
        const user = defaultUser(Date.now().toString());
        const users = [...get().users, user];
        set({ users });
        writeJSON(LEGACY_KEYS.userList, users);
        return user;
    },

    updateGroup: (groupId, patch) => {
        const groups = get().groups.map((g) => (g.groupId === groupId ? { ...g, ...patch } : g));
        set({ groups });
        writeJSON(LEGACY_KEYS.groupList, groups);
    },

    renameGroup: (oldId, newId, patch) => {
        const groups = get().groups.map((g) =>
            g.groupId === oldId ? { ...g, ...patch, groupId: newId } : g,
        );
        const currentGroupId = get().currentGroupId === oldId ? newId : get().currentGroupId;
        set({ groups, currentGroupId });
        writeJSON(LEGACY_KEYS.groupList, groups);
        writeText(LEGACY_KEYS.groupId, currentGroupId);
    },

    removeGroup: (groupId) => {
        const remaining = get().groups.filter((g) => g.groupId !== groupId);
        set({ groups: remaining });
        writeJSON(LEGACY_KEYS.groupList, remaining);
        if (get().currentGroupId === groupId) {
            get().selectGroup(remaining[0]?.groupId ?? '1');
        }
    },

    ensureGroup: (group) => {
        const existing = get().groups.find((g) => g.groupId === group.groupId);
        if (existing) {
            const merged = { ...existing, ...group };
            if (existing.groupName !== merged.groupName || existing.avatar !== merged.avatar) {
                get().updateGroup(group.groupId, merged);
            }
            return merged;
        }
        const groups = [...get().groups, group];
        set({ groups });
        writeJSON(LEGACY_KEYS.groupList, groups);
        return group;
    },

    addBlankGroup: () => {
        const group = defaultGroup(Date.now().toString());
        const groups = [...get().groups, group];
        set({ groups });
        writeJSON(LEGACY_KEYS.groupList, groups);
        return group;
    },

    learnUser: (userId, name, avatar) => {
        if (!userId) return;
        const known = get().knownUsers;
        const prev = known[userId];
        const nextName = name || prev?.name || userId;
        const nextAvatar = avatar || prev?.avatar || '';
        if (prev && prev.name === nextName && prev.avatar === nextAvatar) return;
        set({ knownUsers: { ...known, [userId]: { name: nextName, avatar: nextAvatar } } });
    },

    learnGroup: (groupId, name, avatar) => {
        if (!groupId) return;
        const known = get().knownGroups;
        const prev = known[groupId];
        const nextName = name || prev?.name || groupId;
        const nextAvatar = avatar || prev?.avatar || '';
        if (prev && prev.name === nextName && prev.avatar === nextAvatar) return;
        set({ knownGroups: { ...known, [groupId]: { name: nextName, avatar: nextAvatar } } });
    },
}));

/* ------------------------------ 派生读取 ------------------------------ */

function resolveCurrentUser(state: Pick<SessionState, 'users' | 'currentUserId'>): UserInfo {
    return state.users.find((u) => u.userId === state.currentUserId) ?? defaultUser(state.currentUserId);
}

function resolveCurrentGroup(state: Pick<SessionState, 'groups' | 'currentGroupId'>): GroupInfo {
    return state.groups.find((g) => g.groupId === state.currentGroupId) ?? defaultGroup(state.currentGroupId);
}

export function useCurrentUser(): UserInfo {
    return useSession((s) => s.users.find((u) => u.userId === s.currentUserId) ?? defaultUser(s.currentUserId));
}

export function useCurrentGroup(): GroupInfo {
    return useSession(
        (s) => s.groups.find((g) => g.groupId === s.currentGroupId) ?? defaultGroup(s.currentGroupId),
    );
}

/** 非 React 环境（service / store）里读取当前身份 */
export function currentUser(): UserInfo {
    return resolveCurrentUser(useSession.getState());
}

export function currentGroup(): GroupInfo {
    return resolveCurrentGroup(useSession.getState());
}

export function permissionOf(userId: string): Permission {
    return useSession.getState().users.find((u) => u.userId === userId)?.permission ?? 'Member';
}

export function resolveUserName(userId: string): string {
    if (!userId) return 'BOT';
    const state = useSession.getState();
    return (
        state.knownUsers[userId]?.name ??
        state.users.find((u) => u.userId === userId)?.userName ??
        userId
    );
}

/** 用于 @提及 自动补全的候选列表：本机身份 + 已认识的人 */
export function mentionCandidates(): { userId: string; userName: string; avatar: string }[] {
    const state = useSession.getState();
    const map = new Map<string, { userId: string; userName: string; avatar: string }>();
    state.users.forEach((u) => map.set(u.userId, { userId: u.userId, userName: u.userName, avatar: u.avatar }));
    Object.entries(state.knownUsers).forEach(([userId, person]) => {
        if (!map.has(userId)) map.set(userId, { userId, userName: person.name, avatar: person.avatar });
    });
    return [...map.values()];
}
