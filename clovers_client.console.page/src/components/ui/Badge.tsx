import { cn } from '@/lib/cn';

export function Badge({
    count,
    dot,
    className,
}: {
    count?: number;
    dot?: boolean;
    className?: string;
}) {
    const show = dot || (count !== undefined && count > 0);
    if (!show) return null;
    return (
        <span
            className={cn(
                'inline-flex min-w-[18px] items-center justify-center rounded-[var(--r-xs)] bg-accent px-1.5 text-[10px] font-semibold leading-[18px] text-accentfg',
                dot && 'size-2 min-w-0 p-0',
                className,
            )}
        >
            {!dot && count !== undefined && count > 99 ? '99+' : !dot ? count : ''}
        </span>
    );
}

export function StatusDot({ state }: { state: 'connecting' | 'online' | 'offline' }) {
    const color =
        state === 'online'
            ? 'var(--c-success)'
            : state === 'connecting'
              ? 'var(--c-warning)'
              : 'var(--c-danger)';
    return (
        <span className="relative inline-flex size-2 shrink-0">
            <span className="absolute inset-0 rounded-full" style={{ background: color }} />
            {state !== 'online' && (
                <span
                    className="absolute inset-0 animate-pulse-dot rounded-full"
                    style={{ background: color }}
                />
            )}
        </span>
    );
}
