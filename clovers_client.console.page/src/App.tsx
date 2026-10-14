import { useCallback, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatHeader } from '@/components/layout/ChatHeader';
import { BackgroundLayer } from '@/components/layout/BackgroundLayer';
import { MessageList } from '@/components/chat/MessageList';
import { Composer } from '@/components/chat/Composer';
import { SearchBar } from '@/components/chat/SearchBar';
import { CommandPalette } from '@/components/overlays/CommandPalette';
import { SettingsPanel } from '@/components/overlays/SettingsPanel';
import { ShortcutHelp } from '@/components/overlays/ShortcutHelp';
import { GroupDialog } from '@/components/overlays/GroupDialog';
import { UserDialog } from '@/components/overlays/UserDialog';
import { ImageLightbox } from '@/components/overlays/ImageLightbox';
import { MessageContextMenu } from '@/components/overlays/MessageContextMenu';
import { Toasts } from '@/components/ui/Toasts';
import { useHotkeys, type Hotkey } from '@/hooks/useHotkeys';
import { useChat, totalUnread } from '@/store/chat';
import { useUi, toast } from '@/store/ui';
import { useSession } from '@/store/session';
import { initSystemThemeWatch, useSettings } from '@/store/settings';
import { actions, startApp } from '@/store/bridge';
import { downloadText } from '@/lib/download';
import { feedToMarkdown, safeFileName } from '@/lib/export';

export default function App() {
    const overlay = useUi((s) => s.overlay);
    const closeOverlay = useUi((s) => s.closeOverlay);
    const searchOpen = useUi((s) => s.searchOpen);
    const setSearchOpen = useUi((s) => s.setSearchOpen);
    const lightbox = useUi((s) => s.lightbox);
    const closeLightbox = useUi((s) => s.closeLightbox);
    const toggleSidebar = useUi((s) => s.toggleSidebar);
    const openOverlay = useUi((s) => s.openOverlay);

    const currentGroupId = useSession((s) => s.currentGroupId);
    const unread = useChat((s) => s.unread);

    const unreadTotal = useMemo(() => totalUnread(unread), [unread]);

    /* --------------------- 启动：主题、连接 --------------------- */
    useEffect(() => {
        initSystemThemeWatch();
        startApp();
    }, []);

    // 切换会话时载入历史并清掉未读
    useEffect(() => {
        void actions.selectGroupAndLoad(currentGroupId);
    }, [currentGroupId]);

    // 标题栏未读角标
    useEffect(() => {
        document.title = unreadTotal > 0 ? `(${unreadTotal}) clovers 终端` : 'clovers 终端';
    }, [unreadTotal]);

    // 通知权限在浏览器设置里被撤销时，把开关同步关掉
    useEffect(() => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'denied' && useSettings.getState().preferences.notify) {
            useSettings.getState().setPreference('notify', false);
        }
    }, []);

    /* --------------------- 动作 --------------------- */
    const stepGroup = useCallback(
        (delta: number) => {
            const list = useSession.getState().groups;
            if (list.length < 2) return;
            const index = list.findIndex((g) => g.groupId === useSession.getState().currentGroupId);
            const next = list[(index + delta + list.length) % list.length];
            if (next) void actions.selectGroupAndLoad(next.groupId);
        },
        [],
    );

    const exportCurrent = useCallback(() => {
        const session = useSession.getState();
        const group = session.groups.find((g) => g.groupId === session.currentGroupId);
        const items = useChat.getState().feeds[session.currentGroupId] ?? [];
        if (!group || items.length === 0) {
            toast.warning('当前会话没有可导出的消息');
            return;
        }
        downloadText(
            `${safeFileName(group.groupName)}-${Date.now()}.md`,
            feedToMarkdown(group, items),
            'text/markdown;charset=utf-8',
        );
        toast.success('已开始导出');
    }, []);

    const clearCurrent = useCallback(() => {
        void actions.clearCurrentGroup();
        toast.success('聊天记录已清空');
    }, []);

    /* --------------------- 全局快捷键 --------------------- */
    const hotkeys = useMemo<Hotkey[]>(
        () => [
            { combo: 'mod+k', handler: () => openOverlay('command') },
            { combo: 'mod+/', handler: () => openOverlay('shortcuts') },
            { combo: 'mod+,', handler: () => openOverlay('settings') },
            { combo: 'mod+b', handler: () => toggleSidebar() },
            // 在输入框里也要能用，所以放开 allowInInput
            { combo: 'mod+f', handler: () => setSearchOpen(true), allowInInput: true },
            { combo: 'mod+shift+k', handler: clearCurrent },
            { combo: 'mod+shift+e', handler: exportCurrent },
            { combo: 'alt+arrowup', handler: () => stepGroup(-1) },
            { combo: 'alt+arrowdown', handler: () => stepGroup(1) },
            {
                combo: 'escape',
                allowInInput: true,
                handler: () => {
                    if (lightbox) closeLightbox();
                    else if (searchOpen) setSearchOpen(false);
                    else if (overlay !== 'none') closeOverlay();
                },
            },
        ],
        [
            openOverlay,
            toggleSidebar,
            setSearchOpen,
            clearCurrent,
            exportCurrent,
            stepGroup,
            lightbox,
            closeLightbox,
            searchOpen,
            overlay,
            closeOverlay,
        ],
    );

    useHotkeys(hotkeys);

    return (
        <>
            {/* 用户自定义背景图（设置了才渲染出来） */}
            <BackgroundLayer />
            {/* 背景光斑，颜色跟随主题色；有背景图时会自动隐藏 */}
            <div className="aurora" aria-hidden />

            <div className="app-shell">
                <Sidebar />

                <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
                    <ChatHeader />
                    {searchOpen && <SearchBar />}
                    <MessageList groupId={currentGroupId} />
                    <Composer groupId={currentGroupId} />
                </main>
            </div>

            {overlay === 'command' && <CommandPalette onClose={closeOverlay} />}
            {overlay === 'settings' && <SettingsPanel onClose={closeOverlay} />}
            {overlay === 'shortcuts' && <ShortcutHelp onClose={closeOverlay} />}
            {overlay === 'groups' && <GroupDialog onClose={closeOverlay} />}
            {overlay === 'users' && <UserDialog onClose={closeOverlay} />}

            <ImageLightbox />
            <MessageContextMenu />
            <Toasts />
        </>
    );
}
