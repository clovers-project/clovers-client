import { memo } from 'react';
import { AlertCircle, Check, CornerUpLeft, MoreHorizontal, Reply } from 'lucide-react';
import type { FeedItem } from '@/types/protocol';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Markdown } from './Markdown';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { useSettings } from '@/store/settings';
import { useSession, resolveUserName } from '@/store/session';
import { useUi } from '@/store/ui';
import { copyText } from '@/lib/download';
import { toast } from '@/store/ui';
import { PERMISSION_LABEL } from '@/types/protocol';

export type UserFeedItem = Extract<FeedItem, { kind: 'user' }>;

interface MessageItemProps {
    item: UserFeedItem;
    /** 与上一条是同一个人、时间接近 —— 视觉上合并，省掉重复头像 */
    compact: boolean;
    /** 引用到的消息摘要（可能已被删除） */
    repliedPreview?: { name: string; text: string } | null;
    onJumpTo: (messageId: string) => void;
}

const PERMISSION_STYLE: Record<string, string | null> = {
    SuperUser: 'bg-danger/15 text-danger',
    Owner: 'bg-warning/15 text-warning',
    Admin: 'bg-accent/15 text-accent',
    Member: null,
};

export const MessageItem = memo(function MessageItem({
    item,
    compact,
    repliedPreview,
    onJumpTo,
}: MessageItemProps) {
    const showTimestamps = useSettings((s) => s.preferences.showTimestamps);
    const openContextMenu = useUi((s) => s.openContextMenu);
    const openLightbox = useUi((s) => s.openLightbox);
    const setReplyTo = useUi((s) => s.setReplyTo);
    const addMention = useUi((s) => s.addMention);
    const currentUserId = useSession((s) => s.currentUserId);

    // @提及 列表里空字符串是旧协议里「@BOT」的约定
    const mentions = item.at.map((id) => ({ id, name: id === '' ? 'BOT' : resolveUserName(id) }));

    const openMenu = (x: number, y: number) => openContextMenu({ x, y, messageId: item.id });

    return (
        <article
            data-mid={item.id}
            data-self={item.self ? 'true' : 'false'}
            className={cn(
                'group/msg relative flex w-full gap-2.5 px-1 scroll-mt-24',
                item.self ? 'flex-row-reverse' : 'flex-row',
                compact ? 'mt-0.5' : 'mt-[var(--gap-msg)]',
            )}
        >
            {/* 头像：合并显示时用占位保持对齐 */}
            <div className="w-9 shrink-0">
                {compact ? null : (
                    <Avatar
                        seed={item.senderId}
                        name={item.senderName}
                        src={item.avatar}
                        size={36}
                        ring
                    />
                )}
            </div>

            <div
                className={cn(
                    'flex min-w-0 max-w-[min(72ch,82%)] flex-col',
                    item.self ? 'items-end' : 'items-start',
                )}
            >
                {!compact && (
                    <div className="mb-1 flex items-center gap-2 px-0.5 text-xs">
                        <span className="font-medium text-fg">{item.senderName}</span>
                        {PERMISSION_STYLE[item.permission] && (
                            <span
                                className={cn(
                                    'rounded-[var(--r-xs)] px-1.5 py-px text-[10px] font-medium',
                                    PERMISSION_STYLE[item.permission],
                                )}
                            >
                                {PERMISSION_LABEL[item.permission]}
                            </span>
                        )}
                        {showTimestamps && (
                            <span className="text-subtle">{formatTime(item.time)}</span>
                        )}
                    </div>
                )}

                <div
                    className={cn(
                        // min-w-0 / max-w-full 很关键：align-items 不是 stretch 时，
                        // 气泡会按 max-content 撑开并把整个页面顶宽（移动端尤其明显）
                        'relative flex min-w-0 max-w-full items-end gap-1.5',
                        item.self && 'flex-row-reverse',
                    )}
                >
                    <div
                        className={cn(
                            'relative min-w-0 max-w-full rounded-[var(--r-lg)] px-[var(--pad-bubble-x)] py-[var(--pad-bubble-y)] shadow-sm',
                            item.self
                                ? 'rounded-br-[var(--r-xs)] bg-bubbleout text-bubbleoutfg'
                                : 'rounded-bl-[var(--r-xs)] bg-bubblein text-bubbleinfg border border-linesoft',
                        )}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            openMenu(e.clientX, e.clientY);
                        }}
                    >
                        {/* 回复引用 */}
                        {item.reply && (
                            <button
                                type="button"
                                onClick={() => onJumpTo(item.reply!)}
                                className={cn(
                                    'mb-1.5 flex w-full flex-col items-start gap-0.5 rounded-[var(--r-xs)] border-l-2 px-2 py-1 text-left text-xs transition-opacity hover:opacity-80',
                                    item.self
                                        ? 'border-white/60 bg-black/15'
                                        : 'border-accent bg-black/5 dark:bg-white/5',
                                )}
                            >
                                <span className="flex items-center gap-1 font-medium opacity-90">
                                    <Reply size={11} />
                                    {repliedPreview?.name ?? '未知用户'}
                                </span>
                                <span className="line-clamp-2 w-full opacity-70">
                                    {repliedPreview?.text || '原消息已删除'}
                                </span>
                            </button>
                        )}

                        {/* @提及 */}
                        {mentions.length > 0 && (
                            <div className="mb-1 flex flex-wrap gap-1">
                                {mentions.map((m) => (
                                    <span
                                        key={m.id || 'bot'}
                                        className={cn(
                                            'rounded-[var(--r-xs)] px-1.5 py-px text-[11px] font-medium',
                                            item.self ? 'bg-white/20' : 'bg-accent/15 text-accent',
                                        )}
                                    >
                                        @{m.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {item.text.trim() && <Markdown text={item.text} />}

                        {item.images.length > 0 && (
                            <div
                                className={cn(
                                    'mt-1.5 grid gap-1.5',
                                    item.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                                )}
                            >
                                {item.images.map((url, index) => (
                                    <button
                                        key={`${url}-${index}`}
                                        type="button"
                                        onClick={() => openLightbox(item.images, index)}
                                        className="group/img overflow-hidden rounded-[var(--r-xs)] border border-black/10"
                                    >
                                        <img
                                            src={url}
                                            alt="聊天图片"
                                            loading="lazy"
                                            className="max-h-64 w-full object-cover transition-transform duration-[var(--dur-slow)] group-hover/img:scale-[1.03]"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* 时间戳跟随在气泡内右下角，暗色/亮色都能读 */}
                        {showTimestamps && compact && (
                            <span className="ml-2 align-bottom text-[10px] opacity-55">
                                {formatTime(item.time)}
                            </span>
                        )}
                    </div>

                    {/* 悬浮快捷操作 */}
                    <div
                        className={cn(
                            'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-[var(--dur-fast)]',
                            'group-hover/msg:opacity-100 focus-within:opacity-100',
                        )}
                    >
                        <IconButton
                            size="sm"
                            tip="回复"
                            icon={<CornerUpLeft size={14} />}
                            onClick={() => setReplyTo(item.id)}
                        />
                        <IconButton
                            size="sm"
                            tip="复制文本"
                            icon={<Check size={14} />}
                            onClick={async () => {
                                const ok = await copyText(item.text);
                                if (ok) toast.success('已复制到剪贴板');
                                else toast.error('复制失败');
                            }}
                        />
                        {!item.self && (
                            <IconButton
                                size="sm"
                                tip={`@ ${item.senderName}`}
                                icon={<span className="text-[13px] font-semibold">@</span>}
                                onClick={() => addMention(item.senderId)}
                            />
                        )}
                        <IconButton
                            size="sm"
                            tip="更多"
                            icon={<MoreHorizontal size={14} />}
                            onClick={(e) => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                openMenu(rect.left, rect.bottom + 4);
                            }}
                        />
                    </div>
                </div>

                {/* 发送状态：收到服务端回显（同 echo）之后才会变成 sent */}
                {item.self && item.status !== 'sent' && (
                    <span className="mt-1 flex items-center gap-1.5 px-0.5 text-[11px]">
                        {item.status === 'sending' ? (
                            <>
                                <span className="size-2.5 animate-spin-slow rounded-full border-[1.5px] border-subtle border-t-transparent" />
                                <span className="text-subtle">发送中…</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={11} className="text-danger" />
                                <span className="text-danger">等待重连后发送</span>
                            </>
                        )}
                    </span>
                )}
                {item.senderId === currentUserId && item.status === 'sent' && item.self && (
                    <span className="sr-only">自己发送的消息</span>
                )}
            </div>
        </article>
    );
});
