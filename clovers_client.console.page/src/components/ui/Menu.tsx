import { useRef, useState, type ReactNode } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/cn';

export interface MenuItem {
    label: ReactNode;
    icon?: ReactNode;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
    /** 显示在右侧的快捷键提示 */
    hint?: ReactNode;
}

/** 轻量下拉菜单：点击触发器展开，点外部或 Esc 收起 */
export function Menu({
    trigger,
    items,
    align = 'end',
    header,
    className,
}: {
    trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
    items: MenuItem[];
    align?: 'start' | 'end';
    header?: ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);

    return (
        <div className={cn('relative', className)} ref={ref}>
            {trigger({ open, toggle: () => setOpen((v) => !v) })}
            {open && (
                <div
                    role="menu"
                    className={cn(
                        'absolute top-[calc(100%+6px)] z-40 w-56 animate-pop-in overflow-hidden rounded-[var(--r-md)] border border-line bg-elevated py-1 shadow-lg',
                        align === 'end' ? 'right-0' : 'left-0',
                    )}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setOpen(false);
                    }}
                >
                    {header && (
                        <div className="border-b border-line px-3 py-1.5 text-[11px] text-subtle">
                            {header}
                        </div>
                    )}
                    {items.map((item, index) => (
                        <button
                            key={index}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            onClick={() => {
                                setOpen(false);
                                item.onSelect();
                            }}
                            className={cn(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                item.danger
                                    ? 'text-danger hover:bg-danger/12'
                                    : 'text-fg hover:bg-hover',
                            )}
                        >
                            {item.icon && <span className="shrink-0 text-subtle">{item.icon}</span>}
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.hint && (
                                <span className="shrink-0 text-[11px] text-subtle">{item.hint}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
