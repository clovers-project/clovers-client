import { useEffect, useMemo, useRef, useState } from 'react';
import {
    CornerDownLeft,
    Eraser,
    FileText,
    Hash,
    Moon,
    Plug,
    Search,
    Settings,
    Sun,
    User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { useSession } from '@/store/session';
import { useChat } from '@/store/chat';
import { useUi, toast } from '@/store/ui';
import { PALETTES, paletteSwatch, useSettings } from '@/store/settings';
import { actions, reconnect } from '@/store/bridge';
import { cn } from '@/lib/cn';
import { kbdLabel } from '@/lib/platform';
import { downloadText } from '@/lib/download';
import { feedToMarkdown, safeFileName } from '@/lib/export';

interface Command {
    id: string;
    group: string;
    label: string;
    hint?: string;
    icon: ReactNode;
    keywords?: string;
    run: () => void;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
    const groups = useSession((s) => s.groups);
    const users = useSession((s) => s.users);
    const feeds = useChat((s) => s.feeds);
    const setAppearance = useSettings((s) => s.setAppearance);
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const commands = useMemo<Command[]>(() => {
        const list: Command[] = [];

        groups.forEach((group) => {
            list.push({
                id: `group-${group.groupId}`,
                group: '会话',
                label: group.groupName,
                hint: group.groupId,
                icon: (
                    <Avatar seed={group.groupId} name={group.groupName} src={group.avatar} size={20} />
                ),
                keywords: `${group.groupName} ${group.groupId}`,
                run: () => {
                    void actions.selectGroupAndLoad(group.groupId);
                    onClose();
                },
            });
        });

        users.forEach((user) => {
            list.push({
                id: `user-${user.userId}`,
                group: '身份',
                label: `切换为 ${user.userName}`,
                hint: user.userId,
                icon: <User size={15} />,
                keywords: `user ${user.userName} ${user.userId}`,
                run: () => {
                    actions.selectUser(user.userId);
                    toast.success(`已切换身份：${user.userName}`);
                    onClose();
                },
            });
        });

        PALETTES.forEach((palette) => {
            list.push({
                id: `palette-${palette.id}`,
                group: '外观',
                label: `主题色：${palette.name}`,
                icon: (
                    <span
                        className="block size-3.5 rounded-[var(--r-xs)]"
                        style={{ background: paletteSwatch(palette) }}
                    />
                ),
                keywords: `theme palette color ${palette.name}`,
                run: () => {
                    setAppearance({ palette: palette.id });
                    onClose();
                },
            });
        });

        list.push(
            {
                id: 'palette-auto',
                group: '外观',
                label: '主题色：跟随背景图',
                icon: <span className="block size-3.5 rounded-[var(--r-xs)] bg-accent" />,
                keywords: 'auto background palette 背景图 取色',
                run: () => {
                    void actions.extractThemeFromBackground();
                    onClose();
                },
            },
            {
                id: 'mode-dark',
                group: '外观',
                label: '切换到暗色模式',
                icon: <Moon size={15} />,
                keywords: 'dark mode theme 暗色 深色',
                run: () => {
                    setAppearance({ mode: 'dark' });
                    onClose();
                },
            },
            {
                id: 'mode-light',
                group: '外观',
                label: '切换到亮色模式',
                icon: <Sun size={15} />,
                keywords: 'light mode theme 亮色 浅色',
                run: () => {
                    setAppearance({ mode: 'light' });
                    onClose();
                },
            },
            {
                id: 'open-settings',
                group: '操作',
                label: '打开设置',
                icon: <Settings size={15} />,
                hint: kbdLabel('mod+,'),
                keywords: 'settings preference 设置 背景图',
                run: () => useUi.getState().openOverlay('settings'),
            },
            {
                id: 'reconnect',
                group: '操作',
                label: '重新连接终端',
                icon: <Plug size={15} />,
                keywords: 'reconnect websocket 重连',
                run: () => {
                    reconnect();
                    toast.info('正在重新连接…');
                    onClose();
                },
            },
            {
                id: 'clear-group',
                group: '操作',
                label: '清空当前会话记录',
                icon: <Eraser size={15} />,
                hint: kbdLabel('mod+shift+k'),
                keywords: 'clear erase 清空 删除',
                run: () => {
                    void actions.clearCurrentGroup();
                    onClose();
                },
            },
            {
                id: 'export-md',
                group: '操作',
                label: '导出当前会话为 Markdown',
                icon: <FileText size={15} />,
                hint: kbdLabel('mod+shift+e'),
                keywords: 'export download markdown 导出',
                run: () => {
                    const session = useSession.getState();
                    const group = session.groups.find((g) => g.groupId === session.currentGroupId);
                    const items = feeds[session.currentGroupId] ?? [];
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
                    onClose();
                },
            },
            {
                id: 'open-groups',
                group: '操作',
                label: '管理会话',
                icon: <Hash size={15} />,
                keywords: 'group manage 会话 管理',
                run: () => useUi.getState().openOverlay('groups'),
            },
            {
                id: 'open-users',
                group: '操作',
                label: '管理身份',
                icon: <User size={15} />,
                keywords: 'user identity 身份 管理',
                run: () => useUi.getState().openOverlay('users'),
            },
        );

        return list;
    }, [groups, users, feeds, setAppearance, onClose]);

    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return commands.slice(0, 40);
        return commands
            .map((command) => {
                const haystack =
                    `${command.label} ${command.hint ?? ''} ${command.keywords ?? ''}`.toLowerCase();
                const exact = haystack.indexOf(keyword);
                return { command, score: exact === -1 ? Number.POSITIVE_INFINITY : exact };
            })
            .filter((entry) => Number.isFinite(entry.score))
            .sort((a, b) => a.score - b.score)
            .slice(0, 40)
            .map((entry) => entry.command);
    }, [commands, query]);

    useEffect(() => setIndex(0), [query]);

    // 让当前选中项始终可见
    useEffect(() => {
        listRef.current
            ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [index]);

    const runAt = (i: number) => {
        const command = filtered[i];
        if (command) command.run();
    };

    // 按分组渲染，同时保留全局序号用于键盘选择
    const grouped: { title: string; entries: { command: Command; index: number }[] }[] = [];
    filtered.forEach((command, i) => {
        const last = grouped.at(-1);
        if (last && last.title === command.group) last.entries.push({ command, index: i });
        else grouped.push({ title: command.group, entries: [{ command, index: i }] });
    });

    return (
        <Modal open onClose={onClose} bare width="md">
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
                <Search size={16} className="shrink-0 text-subtle" />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setIndex((i) => Math.min(i + 1, filtered.length - 1));
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            runAt(index);
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            onClose();
                        }
                    }}
                    placeholder="搜索会话、身份，或执行操作…"
                    className="min-w-0 flex-1 bg-transparent pr-8 text-sm placeholder:text-subtle focus:outline-none"
                />
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
                {filtered.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-subtle">没有匹配的结果</p>
                )}
                {grouped.map((section) => (
                    <div key={section.title} className="mb-1">
                        <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                            {section.title}
                        </p>
                        {section.entries.map(({ command, index: i }) => (
                            <button
                                key={command.id}
                                type="button"
                                data-index={i}
                                onMouseEnter={() => setIndex(i)}
                                onClick={() => runAt(i)}
                                className={cn(
                                    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                                    i === index ? 'bg-accentsoft text-accent' : 'hover:bg-hover',
                                )}
                            >
                                <span className="flex size-5 shrink-0 items-center justify-center text-subtle">
                                    {command.icon}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                                {command.hint && (
                                    <span className="shrink-0 truncate text-[11px] text-subtle">
                                        {command.hint}
                                    </span>
                                )}
                                {i === index && <CornerDownLeft size={12} className="shrink-0" />}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            <footer className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-subtle">
                <span>↑↓ 选择 · Enter 执行</span>
                <span>{filtered.length} 项结果</span>
            </footer>
        </Modal>
    );
}
