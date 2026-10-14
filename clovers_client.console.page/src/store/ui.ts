/**
 * ui.ts —— 纯界面状态：浮层开关、Toast、灯箱、输入框的临时状态。
 * 这里不放任何业务数据，删掉它应用依然能跑（只是没法交互）。
 */
import { create } from 'zustand';
import { uid } from '@/lib/id';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';

export type OverlayId = 'none' | 'settings' | 'shortcuts' | 'users' | 'groups' | 'command';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
    id: string;
    kind: ToastKind;
    title: string;
    description?: string;
}

export interface Attachment {
    id: string;
    file: File;
    /** object URL，用于本地预览；移除时记得 revoke */
    previewUrl: string;
}

export interface LightboxState {
    images: string[];
    index: number;
}

export interface ContextMenuState {
    x: number;
    y: number;
    messageId: string;
}

interface UiState {
    overlay: OverlayId;
    sidebarOpen: boolean;
    searchOpen: boolean;
    searchQuery: string;
    searchActiveIndex: number;
    /** 由 MessageList 渲染后回填的真实匹配数 */
    searchMatchCount: number;
    lightbox: LightboxState | null;
    contextMenu: ContextMenuState | null;
    toasts: Toast[];

    /* 输入区临时状态 */
    replyTo: string | null;
    mentions: string[];
    atBot: boolean;
    attachments: Attachment[];

    openOverlay: (overlay: OverlayId) => void;
    closeOverlay: () => void;
    toggleSidebar: (open?: boolean) => void;

    setSearchOpen: (open: boolean) => void;
    setSearchQuery: (query: string) => void;
    setSearchIndex: (index: number) => void;
    setSearchMatchCount: (count: number) => void;

    openLightbox: (images: string[], index: number) => void;
    closeLightbox: () => void;
    stepLightbox: (delta: number) => void;

    openContextMenu: (state: ContextMenuState) => void;
    closeContextMenu: () => void;

    pushToast: (toast: Omit<Toast, 'id'> & { id?: string }) => string;
    dismissToast: (id: string) => void;

    setReplyTo: (id: string | null) => void;
    toggleMention: (userId: string) => void;
    addMention: (userId: string) => void;
    clearMentions: () => void;
    setAtBot: (value: boolean) => void;
    addAttachments: (files: File[]) => void;
    removeAttachment: (id: string) => void;
    clearAttachments: () => void;
    /** 发送完成后重置输入区 */
    resetComposer: () => void;
}

function readAtBot(): boolean {
    try {
        return localStorage.getItem('atbot') === 'true';
    } catch {
        return false;
    }
}

export const useUi = create<UiState>((set, get) => ({
    overlay: 'none',
    sidebarOpen: false,
    searchOpen: false,
    searchQuery: '',
    searchActiveIndex: 0,
    searchMatchCount: 0,
    lightbox: null,
    contextMenu: null,
    toasts: [],

    replyTo: null,
    mentions: [],
    atBot: readAtBot(),
    attachments: [],

    openOverlay: (overlay) => set({ overlay, contextMenu: null, sidebarOpen: false }),
    closeOverlay: () => set({ overlay: 'none' }),
    toggleSidebar: (open) => set((s) => ({ sidebarOpen: open ?? !s.sidebarOpen })),

    setSearchOpen: (searchOpen) =>
        set(searchOpen ? { searchOpen } : { searchOpen, searchQuery: '', searchActiveIndex: 0 }),
    setSearchQuery: (searchQuery) => set({ searchQuery, searchActiveIndex: 0 }),
    setSearchIndex: (searchActiveIndex) => set({ searchActiveIndex: Math.max(0, searchActiveIndex) }),
    setSearchMatchCount: (searchMatchCount) => set({ searchMatchCount }),

    openLightbox: (images, index) => set({ lightbox: { images, index } }),
    closeLightbox: () => set({ lightbox: null }),
    stepLightbox: (delta) =>
        set((s) => {
            if (!s.lightbox) return {};
            const count = s.lightbox.images.length;
            if (count === 0) return {};
            const index = (s.lightbox.index + delta + count) % count;
            return { lightbox: { ...s.lightbox, index } };
        }),

    openContextMenu: (state) => set({ contextMenu: state }),
    closeContextMenu: () => set({ contextMenu: null }),

    pushToast: (toast) => {
        const id = toast.id ?? uid('toast');
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
        // 错误多留一会儿，方便阅读
        const ttl = toast.kind === 'error' ? 6000 : 3200;
        window.setTimeout(() => get().dismissToast(id), ttl);
        return id;
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    setReplyTo: (replyTo) => set({ replyTo }),

    toggleMention: (userId) =>
        set((s) => ({
            mentions: s.mentions.includes(userId)
                ? s.mentions.filter((m) => m !== userId)
                : [...s.mentions, userId],
        })),

    addMention: (userId) =>
        set((s) => (s.mentions.includes(userId) ? {} : { mentions: [...s.mentions, userId] })),

    clearMentions: () => set({ mentions: [] }),

    setAtBot: (value) => {
        try {
            localStorage.setItem('atbot', String(value));
        } catch {
            /* ignore */
        }
        set({ atBot: value });
    },

    addAttachments: (files) =>
        set((s) => {
            const added: Attachment[] = files
                .filter((file) => file.type.startsWith('image/'))
                .map((file) => ({ id: uid('att'), file, previewUrl: URL.createObjectURL(file) }));
            if (added.length === 0) return {};
            return { attachments: [...s.attachments, ...added] };
        }),

    removeAttachment: (id) =>
        set((s) => {
            const target = s.attachments.find((a) => a.id === id);
            if (target) URL.revokeObjectURL(target.previewUrl);
            return { attachments: s.attachments.filter((a) => a.id !== id) };
        }),

    clearAttachments: () =>
        set((s) => {
            s.attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
            return { attachments: [] };
        }),

    resetComposer: () =>
        set((s) => {
            s.attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
            return { attachments: [], mentions: [], replyTo: null };
        }),
}));

/** 供非 React 代码调用的便捷入口 */
export const toast = {
    info: (title: string, description?: string) =>
        useUi.getState().pushToast({ kind: 'info', title, description }),
    success: (title: string, description?: string) =>
        useUi.getState().pushToast({ kind: 'success', title, description }),
    warning: (title: string, description?: string) =>
        useUi.getState().pushToast({ kind: 'warning', title, description }),
    error: (title: string, description?: string) =>
        useUi.getState().pushToast({ kind: 'error', title, description }),
};

/** 草稿读写：按会话保存输入框内容 */
export const drafts = {
    all: (): Record<string, string> => readJSON<Record<string, string>>(KEYS.drafts, {}),
    save(groupId: string, text: string) {
        const current = drafts.all();
        if (text) current[groupId] = text;
        else delete current[groupId];
        writeJSON(KEYS.drafts, current);
    },
    get(groupId: string): string {
        return drafts.all()[groupId] ?? '';
    },
};
