import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
    tip?: string;
    tipSide?: 'top' | 'bottom' | 'right';
    variant?: 'ghost' | 'soft' | 'danger';
    size?: 'sm' | 'md';
    active?: boolean;
}

const VARIANTS = {
    ghost: 'text-muted hover:bg-hover hover:text-fg',
    soft: 'bg-surface2 text-muted border border-line hover:bg-hover hover:text-fg',
    danger: 'text-muted hover:bg-danger/15 hover:text-danger',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { icon, tip, tipSide = 'top', variant = 'ghost', size = 'md', active, className, ...rest },
    ref,
) {
    const button = (
        <button
            ref={ref}
            type="button"
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-[var(--r-sm)] transition-all duration-[var(--dur-fast)]',
                'disabled:cursor-not-allowed disabled:opacity-40',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                size === 'md' ? 'size-9' : 'size-7',
                VARIANTS[variant],
                active && 'bg-accentsoft text-accent hover:bg-accent/25 hover:text-accent',
                className,
            )}
            {...rest}
        >
            {icon}
        </button>
    );
    return tip ? (
        <Tooltip label={tip} side={tipSide}>
            {button}
        </Tooltip>
    ) : (
        button
    );
});
