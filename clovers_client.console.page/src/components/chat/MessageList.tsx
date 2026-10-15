import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ArrowDown, MessageSquareDashed, Search } from 'lucide-react';
import type { FeedItem } from '@/types/protocol';
import { MessageItem, type UserFeedItem } from './MessageItem';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { clearHighlights, focusMatch, highlightMatches } from '@/lib/searchHighlight';
import { formatDayLabel, isSameDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useChat } from '@/store/chat';
import { useUi } from '@/store/ui';

const COMPACT_WINDOW = 2 * 60 * 1000;

export function MessageList({ groupId }: { groupId: string }) {
    const feed = useChat((s) => s.feeds[groupId]);
    const loading = useChat((s) => s.loading[groupId]);
    const unreadAnchor = useChat((s) => s.unreadAnchor[groupId]);
    const quotes = useChat((s) => s.quotes);
    const ensureQuote = useChat((s) => s.ensureQuote);
    const searchOpen = useUi((s) => s.searchOpen);
    const query = useUi((s) => s.searchQuery);
    const activeIndex = useUi((s) => s.searchActiveIndex);
    const setMatchCount = useUi((s) => s.setSearchMatchCount);

    const items = useMemo(() => feed ?? [], [feed]);
    const { ref, atBottom, hasNew, scrollToBottom } = useAutoScroll<HTMLDivElement>(
        `${groupId}:${items.length}:${unreadAnchor ?? ''}`,
    );
    const innerRef = useRef<HTMLDivElement>(null);

    /** 供引用卡片跳转使用：遍历 data-mid，避免 id 里出现特殊字符时的选择器问题 */
    const jumpTo = useCallback((messageId: string) => {
        const root = innerRef.current;
        if (!root) return;
        const target = Array.from(root.querySelectorAll<HTMLElement>('[data-mid]')).find(
            (el) => el.dataset.mid === messageId,
        );
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('animate-flash-ring');
        window.setTimeout(() => target.classList.remove('animate-flash-ring'), 1300);
    }, []);

    /** 搜索高亮：内容渲染完成后再操作 DOM */
    useEffect(() => {
        const root = innerRef.current;
        if (!root) return;
        if (!searchOpen || !query.trim()) {
            clearHighlights(root);
            setMatchCount(0);
            return;
        }
        const total = highlightMatches(root, query);
        setMatchCount(total);
        if (total > 0) focusMatch(root, activeIndex % total);
        return () => clearHighlights(root);
    }, [searchOpen, query, activeIndex, items, setMatchCount]);

    /** 引用卡片要显示的原文摘要：id -> { 发送者, 文本 } */
    const replyPreview = useMemo(() => {
        const map = new Map<string, { name: string; text: string }>();
        items.forEach((item) => {
            if (item.kind === 'user') {
                map.set(item.id, {
                    name: item.senderName,
                    text: item.text.slice(0, 120) || (item.images.length ? '[图片]' : ''),
                });
            }
        });
        // 本地没有的引用（换了设备、或引的是很久以前的消息）用缓存补上
        Object.entries(quotes).forEach(([id, preview]) => {
            if (preview && !map.has(id)) map.set(id, preview);
        });
        return map;
    }, [items, quotes]);

    /**
     * 本地历史里找不到的引用消息，去后端查一次。
     * 放在 effect 而不是渲染里，避免渲染期间触发网络请求。
     */
    useEffect(() => {
        const missing = new Set<string>();
        items.forEach((item) => {
            if (item.kind !== 'user' || !item.reply) return;
            if (quotes[item.reply] !== undefined) return;
            if (items.some((other) => other.id === item.reply)) return;
            missing.add(item.reply);
        });
        missing.forEach((id) => void ensureQuote(id));
    }, [items, quotes, ensureQuote]);

    if (loading && items.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <span className="size-5 animate-spin-slow rounded-full border-2 border-accent border-t-transparent" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-accentsoft text-accent">
                    <MessageSquareDashed size={26} />
                </div>
                <div>
                    <p className="text-sm font-medium">还没有消息</p>
                    <p className="mt-1 text-xs text-muted">
                        在下面输入内容开始对话，支持 Markdown 与图片
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div
                ref={ref}
                className="chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-[var(--pad-panel)] py-4"
            >
                <div ref={innerRef} className="flex flex-col">
                    {items.map((item, index) => {
                        const previous = items[index - 1];
                        const showDay = !previous || !isSameDay(previous.time, item.time);
                        const isUnreadAnchor = unreadAnchor === item.id;
                        return (
                            <div key={item.id} className="contents">
                                {showDay && <DayDivider time={item.time} />}
                                {isUnreadAnchor && <UnreadDivider />}
                                {item.kind === 'system' ? (
                                    <SystemLine item={item} />
                                ) : (
                                    <MessageItem
                                        item={item as UserFeedItem}
                                        compact={
                                            !showDay &&
                                            !!previous &&
                                            previous.kind === 'user' &&
                                            previous.senderId === item.senderId &&
                                            item.time - previous.time < COMPACT_WINDOW
                                        }
                                        repliedPreview={
                                            item.reply ? (replyPreview.get(item.reply) ?? null) : null
                                        }
                                        onJumpTo={jumpTo}
                                    />
                                )}
                            </div>
                        );
                    })}
                    <div className="h-2 shrink-0" />
                </div>
            </div>

            {(!atBottom || hasNew) && (
                <button
                    type="button"
                    onClick={() => scrollToBottom()}
                    className={cn(
                        'glass absolute bottom-4 right-5 z-10 flex items-center gap-1.5 rounded-[var(--r-xs)] border border-line px-3 py-2 text-xs font-medium shadow-md',
                        'animate-fade-up transition-transform hover:-translate-y-0.5',
                        hasNew && 'text-accent',
                    )}
                >
                    <ArrowDown size={14} />
                    {hasNew ? '有新消息' : '回到最新'}
                </button>
            )}
        </div>
    );
}

function DayDivider({ time }: { time: number }) {
    return (
        <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="rounded-[var(--r-xs)] bg-surface2 px-2.5 py-0.5 text-[11px] text-muted">
                {formatDayLabel(time)}
            </span>
            <span className="h-px flex-1 bg-line" />
        </div>
    );
}

function UnreadDivider() {
    return (
        <div className="my-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-danger/50" />
            <span className="rounded-[var(--r-xs)] bg-danger/15 px-2.5 py-0.5 text-[11px] font-medium text-danger">
                以下为新消息
            </span>
            <span className="h-px flex-1 bg-danger/50" />
        </div>
    );
}

function SystemLine({ item }: { item: Extract<FeedItem, { kind: 'system' }> }) {
    return (
        <div className="my-2 flex justify-center">
            <span className="max-w-[80%] rounded-[var(--r-xs)] bg-surface2 px-3 py-1 text-center text-[11px] text-muted">
                {item.text}
            </span>
        </div>
    );
}

/** 搜索无结果时的提示 */
export function NoMatchesHint({ query }: { query: string }) {
    return (
        <p className="flex items-center gap-1.5 text-xs text-muted">
            <Search size={12} />未找到「{query}」
        </p>
    );
}
