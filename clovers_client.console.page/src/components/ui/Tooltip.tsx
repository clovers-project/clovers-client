import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/**
 * 悬浮提示。
 *
 * 关键点：提示气泡通过 Portal 挂到 document.body 上，用 fixed 定位。
 * 早期版本把它渲染在触发元素内部，结果被各种祖先元素裁掉：
 *   - .app-shell 有 overflow: hidden
 *   - 顶栏 / 输入区用了 backdrop-filter，会把自己变成绝对定位后代的包含块
 *   - 竖屏时侧栏是个可滚动抽屉
 * 挂到 body 之后就完全不受这些影响。
 */
type Side = 'top' | 'bottom' | 'right';

const GAP = 8;
const MARGIN = 8;
const DELAY = 120;

export function Tooltip({
    label,
    children,
    side = 'top',
    className,
}: {
    label: ReactNode;
    children: ReactNode;
    side?: Side;
    className?: string;
}) {
    const anchorRef = useRef<HTMLSpanElement>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<number | null>(null);
    const [visible, setVisible] = useState(false);
    const [placement, setPlacement] = useState<Side>(side);
    const [style, setStyle] = useState<CSSProperties | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const hide = useCallback(() => {
        clearTimer();
        setVisible(false);
        setStyle(null);
    }, [clearTimer]);

    const show = useCallback(() => {
        clearTimer();
        timerRef.current = window.setTimeout(() => {
            const el = anchorRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            // 空间不够就自动翻转，避免贴着视口边缘被切掉
            let next: Side = side;
            if (side === 'top' && rect.top < 48) next = 'bottom';
            else if (side === 'bottom' && window.innerHeight - rect.bottom < 48) next = 'top';
            else if (side === 'right' && window.innerWidth - rect.right < 180) next = 'top';
            setPlacement(next);
            setVisible(true);
        }, DELAY);
    }, [clearTimer, side]);

    // 显示之后再量一次尺寸，才能精确居中并夹在视口内
    useLayoutEffect(() => {
        if (!visible) return;
        const anchor = anchorRef.current;
        const bubble = bubbleRef.current;
        if (!anchor || !bubble) return;
        const rect = anchor.getBoundingClientRect();
        const { offsetWidth: w, offsetHeight: h } = bubble;

        let left: number;
        let top: number;
        if (placement === 'top') {
            left = rect.left + rect.width / 2 - w / 2;
            top = rect.top - GAP - h;
        } else if (placement === 'bottom') {
            left = rect.left + rect.width / 2 - w / 2;
            top = rect.bottom + GAP;
        } else {
            left = rect.right + GAP;
            top = rect.top + rect.height / 2 - h / 2;
        }
        left = Math.min(Math.max(MARGIN, left), window.innerWidth - w - MARGIN);
        top = Math.min(Math.max(MARGIN, top), window.innerHeight - h - MARGIN);
        setStyle({ left, top });
    }, [visible, placement, label]);

    // 滚动或缩放会让位置失效，直接关掉最省事也最不打扰
    useEffect(() => {
        if (!visible) return;
        const onScrollOrResize = () => hide();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') hide();
        };
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [visible, hide]);

    useEffect(() => clearTimer, [clearTimer]);

    if (!label) return <>{children}</>;

    return (
        <>
            <span
                ref={anchorRef}
                className={cn('inline-flex', className)}
                onPointerEnter={show}
                onPointerLeave={hide}
                onPointerDown={hide}
                onFocusCapture={show}
                onBlurCapture={hide}
            >
                {children}
            </span>
            {visible &&
                createPortal(
                    <div
                        ref={bubbleRef}
                        role="tooltip"
                        style={style ?? { left: 0, top: 0 }}
                        className={cn(
                            'pointer-events-none fixed z-[200] max-w-[min(280px,80vw)]',
                            'rounded-[var(--r-xs)] border border-line bg-elevated px-2 py-1 text-[11px] font-medium leading-snug text-fg shadow-md',
                            // 不做淡入动画：气泡本来就是要「立刻出现」，
                            // 而且 fill-mode 的动画在极端情况下会让它一直停在 opacity 0。
                            // 测量完成前先藏起来，避免看到它从左上角跳过来
                            style ? 'opacity-100' : 'opacity-0',
                        )}
                    >
                        {label}
                    </div>,
                    document.body,
                )}
        </>
    );
}
