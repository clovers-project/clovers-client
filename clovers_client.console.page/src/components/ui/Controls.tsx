import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** 分段控件：一组互斥选项，做成滑块样式 */
export function Segmented<T extends string>({
    value,
    options,
    onChange,
    className,
    size = 'md',
}: {
    value: T;
    options: { value: T; label: ReactNode; tip?: string }[];
    onChange: (value: T) => void;
    className?: string;
    size?: 'sm' | 'md';
}) {
    return (
        <div
            role="radiogroup"
            className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-[var(--r-md)] border border-line bg-surface2 p-0.5',
                className,
            )}
        >
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={option.tip}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--r-sm)] font-medium transition-all duration-[var(--dur-fast)]',
                            size === 'md' ? 'h-7 px-2.5 text-xs' : 'h-6 px-2 text-[11px]',
                            active
                                ? 'bg-elevated text-fg shadow-sm'
                                : 'text-muted hover:text-fg',
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function Switch({
    checked,
    onChange,
    label,
    description,
    disabled,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-start justify-between gap-4 py-2.5',
                disabled && 'cursor-not-allowed opacity-50',
            )}
        >
            <span className="min-w-0">
                <span className="block text-sm">{label}</span>
                {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={typeof label === 'string' ? label : undefined}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={cn(
                    'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-[var(--dur-base)]',
                    checked ? 'bg-accent' : 'bg-linestrong',
                )}
            >
                <span
                    className={cn(
                        'absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all duration-[var(--dur-base)]',
                        checked ? 'left-[18px]' : 'left-0.5',
                    )}
                />
            </button>
        </label>
    );
}

export function Field({
    label,
    hint,
    children,
    className,
}: {
    label: ReactNode;
    hint?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <label className={cn('block', className)}>
            <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-[11px] text-subtle">{hint}</span>}
        </label>
    );
}

export const inputClass = cn(
    'w-full rounded-[var(--r-md)] border border-line bg-surface2 px-3 py-2 text-sm text-fg',
    'placeholder:text-subtle transition-all duration-[var(--dur-fast)]',
    'focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[var(--c-accent-ring)]',
);

export function Kbd({ children }: { children: ReactNode }) {
    return (
        <kbd className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--r-xs)] border border-line bg-surface2 px-1.5 font-sans text-[11px] text-muted">
            {children}
        </kbd>
    );
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">
            {children}
        </h3>
    );
}
