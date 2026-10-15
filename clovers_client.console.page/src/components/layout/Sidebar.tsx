import { useMemo, useState } from 'react';
import {
    Command,
    MessageSquarePlus,
    Search,
    Settings,
    Sparkles,
    Users,
    X,
} from 'lucide-react';
import { useChat } from '@/store/chat';
import { useCurrentUser, useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import { actions } from '@/store/bridge';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { GroupListItem } from './GroupListItem';
import { cn } from '@/lib/cn';
import { kbdLabel } from '@/lib/platform';

export function Sidebar() {
    const groups = useSession((s) => s.groups);
    const currentGroupId = useSession((s) => s.currentGroupId);
    const summaries = useChat((s) => s.summaries);
    const unread = useChat((s) => s.unread);
    const currentUser = useCurrentUser();
    const sidebarOpen = useUi((s) => s.sidebarOpen);
    const toggleSidebar = useUi((s) => s.toggleSidebar);
    const openOverlay = useUi((s) => s.openOverlay);
    const [filter, setFilter] = useState('');

    const filtered = useMemo(() => {
        const keyword = filter.trim().toLowerCase();
        const sorted = [...groups].sort((a, b) => {
            if (a.groupId === currentGroupId) return -1;
            if (b.groupId === currentGroupId) return 1;
            return (summaries[b.groupId]?.time ?? 0) - (summaries[a.groupId]?.time ?? 0);
        });
        if (!keyword) return sorted;
        return sorted.filter(
            (g) =>
                g.groupName.toLowerCase().includes(keyword) ||
                g.groupId.toLowerCase().includes(keyword),
        );
    }, [groups, filter, currentGroupId, summaries]);

    return (
        <>
            {/* 移动端遮罩 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-[var(--c-overlay)] backdrop-blur-[2px] min-[900px]:hidden"
                    onClick={() => toggleSidebar(false)}
                />
            )}

            <aside
                className={cn(
                    'absolute inset-y-0 left-0 z-[61] flex h-full w-[86vw] max-w-[320px] shrink-0 flex-col border-r border-line bg-surface2',
                    'transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]',
                    'min-[900px]:relative min-[900px]:w-[var(--sidebar-w)] min-[900px]:max-w-none min-[900px]:translate-x-0',
                    sidebarOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full',
                )}
            >
                {/* 品牌与连接状态 */}
                <header className="flex items-center gap-2 px-4 pb-2.5 pt-4">
                    <div className="flex size-8 items-center justify-center rounded-[var(--r-md)] bg-accent text-accentfg shadow-[var(--shadow-glow)]">
                        <Sparkles size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">clovers 终端</p>
                    </div>
                    <IconButton
                        icon={<Command size={16} />}
                        tip={`命令面板 (${kbdLabel('mod+k')})`}
                        onClick={() => openOverlay('command')}
                    />
                    <IconButton
                        icon={<Settings size={16} />}
                        tip="设置"
                        onClick={() => openOverlay('settings')}
                    />
                    <IconButton
                        icon={<X size={16} />}
                        tip="关闭"
                        className="min-[900px]:hidden"
                        onClick={() => toggleSidebar(false)}
                    />
                </header>

                {/* 会话搜索 */}
                <div className="px-3 pb-2">
                    <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-line bg-surface px-2.5 py-1.5 transition-colors focus-within:border-accent">
                        <Search size={14} className="shrink-0 text-subtle" />
                        <input
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="搜索会话…"
                            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-subtle focus:outline-none"
                        />
                        {filter && (
                            <button
                                type="button"
                                aria-label="清除搜索"
                                onClick={() => setFilter('')}
                                className="text-subtle transition-colors hover:text-fg"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between px-4 pb-1 pt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                        会话 · {filtered.length}
                    </span>
                    <div className="flex items-center gap-0.5">
                        <IconButton
                            size="sm"
                            icon={<MessageSquarePlus size={14} />}
                            tip="新建会话"
                            onClick={() => openOverlay('groups')}
                        />
                    </div>
                </div>

                {/* 会话列表 */}
                <nav className="chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-6 text-center text-xs text-subtle">没有匹配的会话</p>
                    ) : (
                        filtered.map((group) => (
                            <GroupListItem
                                key={group.groupId}
                                group={group}
                                active={group.groupId === currentGroupId}
                                unread={unread[group.groupId] ?? 0}
                                summary={summaries[group.groupId]}
                                onSelect={() => {
                                    void actions.selectGroupAndLoad(group.groupId);
                                    toggleSidebar(false);
                                }}
                                onOpenManager={() => openOverlay('groups')}
                            />
                        ))
                    )}
                </nav>

                {/* 当前身份 */}
                <footer className="border-t border-line p-2">
                    <button
                        type="button"
                        onClick={() => openOverlay('users')}
                        className="flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-2 py-2 text-left transition-colors hover:bg-hover"
                    >
                        <Avatar
                            seed={currentUser.userId}
                            name={currentUser.userName}
                            src={currentUser.avatar}
                            size={34}
                        />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                                {currentUser.userName}
                            </span>
                            <span className="block truncate text-[11px] text-subtle">
                                ID {currentUser.userId}
                            </span>
                        </span>
                        <Users size={15} className="shrink-0 text-subtle" />
                    </button>
                </footer>
            </aside>
        </>
    );
}
