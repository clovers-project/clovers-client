/** useClickOutside.ts —— 点击元素之外时触发回调 */
import { useEffect, type RefObject } from 'react';

export function useClickOutside<T extends HTMLElement>(
    ref: RefObject<T | null>,
    handler: () => void,
    enabled = true,
): void {
    useEffect(() => {
        if (!enabled) return;
        const onPointerDown = (event: PointerEvent) => {
            const el = ref.current;
            if (!el) return;
            if (event.target instanceof Node && el.contains(event.target)) return;
            handler();
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [ref, handler, enabled]);
}
