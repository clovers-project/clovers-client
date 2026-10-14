import { MoreHorizontal } from 'lucide-react';
import type { GroupInfo } from '@/types/protocol';
import type { GroupSummary } from '@/store/chat';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';
import { formatRelative, summarize } from '@/lib/format';

interface GroupListItemProps {
    group: GroupInfo;
    active: boolean;
    unread: number;
    summary?: GroupSummary;
    onSelect: () => void;
    onOpenManager: () => void;
}

export function GroupListItem({
    group,
    active,
    unread,
    summary,
    onSelect,
    onOpenManager,
}: GroupListItemProps) {
    const preview = summary?.text ? summarize(summary.text, 42) : '暂无消息';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
            className={cn(
                'group/row relative flex cursor-pointer items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-[var(--pad-row)] transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                active ? 'bg-accentsoft' : 'hover:bg-hover',
            )}
        >
            {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
            )}
            <Avatar
                seed={group.groupId}
                name={group.groupName}
                src={group.avatar}
                size={38}
                status={unread > 0 ? 'tip' : null}
            />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            active ? 'font-semibold text-accent' : 'font-medium text-fg',
                        )}
                    >
                        {group.groupName}
                    </span>
                    {summary?.time ? (
                        <span className="shrink-0 text-[10px] text-subtle">
                            {formatRelative(summary.time)}
                        </span>
                    ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">{preview}</span>
                    {unread > 0 && <Badge count={unread} />}
                    <IconButton
                        size="sm"
                        icon={<MoreHorizontal size={14} />}
                        tip="管理会话"
                        className="hidden group-hover/row:inline-flex focus-visible:inline-flex"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenManager();
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
