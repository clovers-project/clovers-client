import { avatarFallback } from '@/lib/avatar';
import { cn } from '@/lib/cn';

interface AvatarProps {
    /** 决定渐变色的种子，通常用 userId / groupId */
    seed: string;
    name: string;
    src?: string;
    size?: number;
    className?: string;
    /** 右下角状态点 */
    status?: 'online' | 'busy' | 'tip' | null;
    ring?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
    online: 'var(--c-success)',
    busy: 'var(--c-warning)',
    tip: 'var(--c-danger)',
};

export function Avatar({ seed, name, src, size = 40, className, status, ring }: AvatarProps) {
    const fallback = avatarFallback(seed, name);
    const fontSize = Math.max(11, Math.round(size * 0.4));

    return (
        <span
            className={cn('relative inline-flex shrink-0', className)}
            style={{ width: size, height: size }}
        >
            {src ? (
                <img
                    src={src}
                    alt={name}
                    loading="lazy"
                    className={cn(
                        'size-full rounded-full object-cover',
                        ring && 'ring-2 ring-surface',
                    )}
                />
            ) : (
                <span
                    aria-hidden
                    className={cn(
                        'flex size-full items-center justify-center rounded-full font-semibold text-white',
                        ring && 'ring-2 ring-surface',
                    )}
                    style={{ background: fallback.background, fontSize }}
                >
                    {fallback.label}
                </span>
            )}
            {status && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface"
                    style={{
                        width: Math.max(9, size * 0.28),
                        height: Math.max(9, size * 0.28),
                        background: STATUS_COLOR[status],
                    }}
                />
            )}
        </span>
    );
}
