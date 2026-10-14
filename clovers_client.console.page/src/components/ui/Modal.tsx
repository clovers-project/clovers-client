import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    /** 面板宽度 */
    width?: 'sm' | 'md' | 'lg';
    /** 命令面板之类的无边框浮层 */
    bare?: boolean;
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;

export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    width = 'sm',
    bare = false,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Esc 关闭 + 打开期间锁定页面滚动
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // 打开后把焦点移进面板，键盘用户不至于迷失。
        // 优先聚焦输入框；没有输入框就聚焦面板本身，
        // 避免一打开就有一个按钮带上焦点环（看起来像被误触）。
        const timer = window.setTimeout(() => {
            const panel = panelRef.current;
            if (!panel) return;
            const field = panel.querySelector<HTMLElement>('input,textarea,select');
            const target = field ?? panel;
            if (target === panel) panel.tabIndex = -1;
            target.focus({ preventScroll: true });
        }, 40);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            window.clearTimeout(timer);
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[var(--z-overlay)] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
            style={{ background: 'var(--c-overlay)', backdropFilter: 'blur(2px)' }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="presentation"
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                className={cn(
                    // flex + max-h：内容超高时只有中间那块滚动，
                    // 标题栏和底部按钮始终留在视线里
                    'animate-pop-in relative my-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-[var(--r-lg)] border border-line bg-elevated shadow-lg',
                    WIDTHS[width],
                )}
            >
                {!bare && (title || description) && (
                    <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
                        <div className="min-w-0 flex-1">
                            {title && <h2 className="truncate text-base font-semibold">{title}</h2>}
                            {description && (
                                <p className="mt-0.5 text-xs text-muted">{description}</p>
                            )}
                        </div>
                        <IconButton
                            icon={<X size={16} />}
                            tip="关闭 (Esc)"
                            onClick={onClose}
                            variant="ghost"
                        />
                    </header>
                )}
                {!bare && !title && !description && (
                    <IconButton
                        icon={<X size={16} />}
                        tip="关闭 (Esc)"
                        onClick={onClose}
                        variant="ghost"
                        className="absolute right-3 top-3 z-10"
                    />
                )}
                {bare && (
                    <IconButton
                        icon={<X size={16} />}
                        tip="关闭 (Esc)"
                        onClick={onClose}
                        variant="ghost"
                        size="sm"
                        className="absolute right-3 top-3 z-10"
                    />
                )}
                <div
                    className={cn(
                        'min-h-0 flex-1 overflow-y-auto',
                        bare ? '' : 'px-5 py-4',
                    )}
                >
                    {children}
                </div>
                {footer && (
                    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface2/60 px-5 py-3">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body,
    );
}
