import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANTS: Record<Variant, string> = {
    primary: 'bg-accent text-accentfg hover:brightness-110 active:brightness-95 shadow-sm font-medium',
    secondary: 'bg-surface2 text-fg border border-line hover:bg-hover active:bg-active',
    ghost: 'text-muted hover:text-fg hover:bg-hover active:bg-active',
    danger: 'bg-danger/12 text-danger hover:bg-danger/20 active:bg-danger/25',
    subtle: 'bg-accentsoft text-accent hover:bg-accent/25',
};

const SIZES: Record<Size, string> = {
    sm: 'h-7 px-2.5 text-xs rounded-[var(--r-sm)] gap-1.5',
    md: 'h-9 px-3.5 text-sm rounded-[var(--r-md)] gap-2',
    lg: 'h-11 px-5 text-sm rounded-[var(--r-md)] gap-2',
    icon: 'size-9 rounded-[var(--r-md)] justify-center',
    'icon-sm': 'size-7 rounded-[var(--r-sm)] justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    /** 左侧图标 */
    icon?: ReactNode;
    /** 悬浮提示（不传则不渲染） */
    tip?: string;
    tipSide?: 'top' | 'bottom' | 'right';
    loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant = 'secondary',
        size = 'md',
        icon,
        tip,
        tipSide = 'top',
        loading,
        className,
        children,
        disabled,
        ...rest
    },
    ref,
) {
    const button = (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                'relative inline-flex select-none items-center whitespace-nowrap transition-all duration-[var(--dur-fast)]',
                'disabled:cursor-not-allowed disabled:opacity-45',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                VARIANTS[variant],
                SIZES[size],
                className,
            )}
            {...rest}
        >
            {loading ? (
                <span className="size-3.5 shrink-0 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
            ) : (
                icon
            )}
            {children}
        </button>
    );

    if (!tip) return button;
    return (
        <Tooltip label={tip} side={tipSide}>
            {button}
        </Tooltip>
    );
});

export { Tooltip };
