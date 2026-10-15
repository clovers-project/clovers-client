import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AtSign, Copy, CornerUpLeft, Images, Trash2 } from 'lucide-react';
import { useChat } from '@/store/chat';
import { useUi, toast } from '@/store/ui';
import { currentUser } from '@/store/session';
import { copyText } from '@/lib/download';
import { cn } from '@/lib/cn';

/** 消息右键菜单 */
export function MessageContextMenu() {
    const contextMenu = useUi((s) => s.contextMenu);
    const closeMenu = useUi((s) => s.closeContextMenu);
    const setReplyTo = useUi((s) => s.setReplyTo);
    const addMention = useUi((s) => s.addMention);
    const openLightbox = useUi((s) => s.openLightbox);
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const feeds = useChat((s) => s.feeds);

    useLayoutEffect(() => {
        if (!contextMenu) return;
        const el = ref.current;
        const width = el?.offsetWidth ?? 180;
        const height = el?.offsetHeight ?? 200;
        setPosition({
            x: Math.min(contextMenu.x, window.innerWidth - width - 8),
            y: Math.min(contextMenu.y, window.innerHeight - height - 8),
        });
    }, [contextMenu]);

    useEffect(() => {
        if (!contextMenu) return;
        const onPointerDown = (e: PointerEvent) => {
            if (ref.current?.contains(e.target as Node)) return;
            closeMenu();
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [contextMenu, closeMenu]);

    if (!contextMenu) return null;

    // 从 store 里找到这条消息
    const groupIdOfMessage = Object.keys(feeds).find((gid) =>
        feeds[gid]?.some((item) => item.id === contextMenu.messageId),
    );
    const item = groupIdOfMessage
        ? feeds[groupIdOfMessage]?.find((m) => m.id === contextMenu.messageId)
        : undefined;

    if (!item || item.kind !== 'user') return null;

    const actions = [
        {
            label: '回复',
            icon: <CornerUpLeft size={14} />,
            run: () => {
                setReplyTo(item.id);
                addMention(item.senderId);
            },
        },
        {
            label: `@ ${item.senderName}`,
            icon: <AtSign size={14} />,
            hidden: item.self,
            run: () => addMention(item.senderId),
        },
        {
            label: '复制文本',
            icon: <Copy size={14} />,
            hidden: !item.text.trim(),
            run: async () => {
                const ok = await copyText(item.text);
                if (ok) toast.success('已复制到剪贴板');
                else toast.error('复制失败');
            },
        },
        {
            label: `查看图片 (${item.images.length})`,
            icon: <Images size={14} />,
            hidden: item.images.length === 0,
            run: () => openLightbox(item.images, 0),
        },
        {
            label: '删除这条消息',
            icon: <Trash2 size={14} />,
            danger: true,
            hidden: item.senderId !== currentUser().userId && !item.self,
            run: () => {
                void useChat.getState().removeMessage(item.groupId, item.id);
                toast.success('已删除该消息');
            },
        },
    ].filter((action) => !action.hidden);

    return createPortal(
        <div
            ref={ref}
            role="menu"
            className="glass fixed z-[var(--z-overlay)] w-48 animate-pop-in overflow-hidden rounded-[var(--r-md)] border border-line py-1 shadow-lg"
            style={{ left: position.x, top: position.y }}
        >
            <div className="border-b border-line px-3 py-1.5 text-[11px] text-subtle">
                {item.senderName}
            </div>
            {actions.map((action) => (
                <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                        closeMenu();
                        void action.run();
                    }}
                    className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                        action.danger ? 'text-danger hover:bg-danger/12' : 'hover:bg-hover',
                    )}
                >
                    <span className="shrink-0 text-subtle">{action.icon}</span>
                    {action.label}
                </button>
            ))}
        </div>,
        document.body,
    );
}
