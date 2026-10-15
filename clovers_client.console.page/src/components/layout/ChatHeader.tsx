import {
    Download,
    Eraser,
    FileJson,
    FileText,
    Keyboard,
    Menu as MenuIcon,
    MoreHorizontal,
    Search,
    Settings2,
    Users,
} from 'lucide-react';
import { useChat } from '@/store/chat';
import { useConnection, CONNECTION_LABEL } from '@/store/connection';
import { useCurrentGroup, useSession } from '@/store/session';
import { useUi, toast } from '@/store/ui';
import { actions, reconnect } from '@/store/bridge';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { StatusDot } from '@/components/ui/Badge';
import { Menu } from '@/components/ui/Menu';
import { Kbd } from '@/components/ui/Controls';
import { downloadText } from '@/lib/download';
import { feedToJSON, feedToMarkdown, safeFileName } from '@/lib/export';
import { kbdLabel } from '@/lib/platform';

export function ChatHeader() {
    const group = useCurrentGroup();
    const feed = useChat((s) => s.feeds[group.groupId]);
    const connection = useConnection((s) => s.state);
    const openOverlay = useUi((s) => s.openOverlay);
    const setSearchOpen = useUi((s) => s.setSearchOpen);
    const toggleSidebar = useUi((s) => s.toggleSidebar);
    const onlineUsers = useSession((s) => s.onlineUsers);

    const exportAs = (kind: 'md' | 'json') => {
        const items = feed ?? [];
        if (items.length === 0) {
            toast.warning('当前会话没有可导出的消息');
            return;
        }
        const base = safeFileName(group.groupName);
        if (kind === 'md') {
            downloadText(
                `${base}-${Date.now()}.md`,
                feedToMarkdown(group, items),
                'text/markdown;charset=utf-8',
            );
        } else {
            downloadText(
                `${base}-${Date.now()}.json`,
                feedToJSON(group, items),
                'application/json;charset=utf-8',
            );
        }
        toast.success('已开始导出', `共 ${items.length} 条消息`);
    };

    const clearCurrent = () => {
        void actions.clearCurrentGroup();
        toast.success('聊天记录已清空');
    };

    return (
        <header className="glass flex shrink-0 items-center gap-3 border-b border-line px-[var(--pad-panel)] py-2.5">
            <IconButton
                icon={<MenuIcon size={18} />}
                tip="会话列表"
                className="min-[900px]:hidden"
                onClick={() => toggleSidebar()}
            />

            <Avatar seed={group.groupId} name={group.groupName} src={group.avatar} size={38} ring />

            <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="truncate text-sm font-semibold leading-tight">{group.groupName}</h1>
                <p className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] text-muted">
                    <span className="flex shrink-0 items-center gap-1">
                        <StatusDot state={connection} />
                        {CONNECTION_LABEL[connection]}
                    </span>
                    <span className="shrink-0 text-subtle">·</span>
                    <span className="flex min-w-0 items-center gap-1">
                        <Users size={11} className="shrink-0" />
                        <span className="truncate">{onlineUsers} 位成员</span>
                    </span>
                </p>
            </div>

            {connection === 'offline' && (
                <button
                    type="button"
                    onClick={reconnect}
                    className="hidden shrink-0 rounded-[var(--r-xs)] bg-danger/15 px-2.5 py-1 text-[11px] font-medium text-danger transition-colors hover:bg-danger/25 sm:block"
                >
                    重新连接
                </button>
            )}

            <IconButton
                icon={<Search size={17} />}
                tip={`在会话中搜索 (${kbdLabel('mod+f')})`}
                onClick={() => setSearchOpen(true)}
            />
            {/* 窄屏收起，对应功能在「更多」菜单与命令面板里都有 */}
            <IconButton
                icon={<Eraser size={17} />}
                tip="清空当前会话记录"
                className="max-[640px]:hidden"
                onClick={clearCurrent}
            />
            <IconButton
                icon={<Settings2 size={17} />}
                tip="设置"
                className="max-[640px]:hidden"
                onClick={() => openOverlay('settings')}
            />

            <Menu
                align="end"
                header="更多操作"
                items={[
                    {
                        label: '导出为 Markdown',
                        icon: <FileText size={15} />,
                        onSelect: () => exportAs('md'),
                    },
                    {
                        label: '导出为 JSON',
                        icon: <FileJson size={15} />,
                        onSelect: () => exportAs('json'),
                    },
                    {
                        label: '清空当前会话记录',
                        icon: <Eraser size={15} />,
                        onSelect: clearCurrent,
                    },
                    {
                        label: '管理会话',
                        icon: <Users size={15} />,
                        onSelect: () => openOverlay('groups'),
                    },
                    {
                        label: '外观与偏好',
                        icon: <Settings2 size={15} />,
                        onSelect: () => openOverlay('settings'),
                    },
                    {
                        label: '快捷键说明',
                        icon: <Keyboard size={15} />,
                        hint: <Kbd>{kbdLabel('mod+/')}</Kbd>,
                        onSelect: () => openOverlay('shortcuts'),
                    },
                ]}
                trigger={({ toggle }) => (
                    <IconButton icon={<MoreHorizontal size={17} />} tip="更多" onClick={toggle} />
                )}
            />

            <span className="hidden shrink-0 items-center gap-1 text-[11px] text-subtle lg:flex">
                <Download size={12} />
                {feed?.length ?? 0} 条
            </span>
        </header>
    );
}
