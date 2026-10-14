import type { ReactNode } from 'react';
import { AtSign, Reply, X } from 'lucide-react';
import { useUi } from '@/store/ui';
import { useChat } from '@/store/chat';
import { resolveUserName } from '@/store/session';
import { summarize } from '@/lib/format';

/** 输入框上方的「回复 / @提及 / @BOT」状态条 */
export function ComposerStatus({ groupId }: { groupId: string }) {
    const replyTo = useUi((s) => s.replyTo);
    const mentions = useUi((s) => s.mentions);
    const atBot = useUi((s) => s.atBot);
    const setReplyTo = useUi((s) => s.setReplyTo);
    const toggleMention = useUi((s) => s.toggleMention);
    const setAtBot = useUi((s) => s.setAtBot);
    const feed = useChat((s) => s.feeds[groupId]);

    if (!replyTo && mentions.length === 0 && !atBot) return null;

    const replied = feed?.find((item) => item.id === replyTo && item.kind === 'user');

    return (
        <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2">
            {replyTo && (
                <Chip
                    tone="accent"
                    icon={<Reply size={11} />}
                    onClose={() => setReplyTo(null)}
                    title="取消回复"
                >
                    回复 {replied?.kind === 'user' ? replied.senderName : '未知用户'}：
                    {replied?.kind === 'user'
                        ? summarize(replied.text || '[图片]', 24)
                        : '原消息已删除'}
                </Chip>
            )}
            {atBot && (
                <Chip tone="warning" onClose={() => setAtBot(false)} title="取消 @BOT">
                    @ BOT
                </Chip>
            )}
            {mentions.map((userId) => (
                <Chip
                    key={userId}
                    tone="accent"
                    icon={<AtSign size={11} />}
                    onClose={() => toggleMention(userId)}
                    title="取消提及"
                >
                    {resolveUserName(userId)}
                </Chip>
            ))}
        </div>
    );
}

function Chip({
    children,
    onClose,
    icon,
    tone,
    title,
}: {
    children: ReactNode;
    onClose: () => void;
    icon?: ReactNode;
    tone: 'accent' | 'warning';
    title: string;
}) {
    return (
        <span
            className={
                tone === 'accent'
                    ? 'inline-flex max-w-[280px] items-center gap-1 rounded-[var(--r-xs)] bg-accentsoft py-0.5 pl-2 pr-1 text-[11px] text-accent'
                    : 'inline-flex max-w-[280px] items-center gap-1 rounded-[var(--r-xs)] bg-warning/15 py-0.5 pl-2 pr-1 text-[11px] text-warning'
            }
        >
            {icon}
            <span className="truncate">{children}</span>
            <button
                type="button"
                title={title}
                aria-label={title}
                onClick={onClose}
                className="rounded-[var(--r-xs)] p-0.5 transition-colors hover:bg-black/10"
            >
                <X size={11} />
            </button>
        </span>
    );
}
