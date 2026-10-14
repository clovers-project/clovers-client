import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUi, type ToastKind } from '@/store/ui';
import { cn } from '@/lib/cn';

const ICONS: Record<ToastKind, typeof Info> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
};

const COLORS: Record<ToastKind, string> = {
    info: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-danger',
};

export function Toasts() {
    const toasts = useUi((s) => s.toasts);
    const dismiss = useUi((s) => s.dismissToast);

    if (toasts.length === 0) return null;

    return createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
            {toasts.map((toast) => {
                const Icon = ICONS[toast.kind];
                return (
                    <div
                        key={toast.id}
                        role="status"
                        className="glass animate-pop-in pointer-events-auto flex items-start gap-3 rounded-[var(--r-md)] border border-line px-3.5 py-3 shadow-lg"
                    >
                        <Icon size={17} className={cn('mt-0.5 shrink-0', COLORS[toast.kind])} />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug">{toast.title}</p>
                            {toast.description && (
                                <p className="mt-0.5 text-xs leading-snug text-muted">
                                    {toast.description}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            aria-label="关闭提示"
                            onClick={() => dismiss(toast.id)}
                            className="-mr-1 -mt-0.5 rounded-[var(--r-sm)] p-1 text-subtle transition-colors hover:bg-hover hover:text-fg"
                        >
                            <X size={13} />
                        </button>
                    </div>
                );
            })}
        </div>,
        document.body,
    );
}
