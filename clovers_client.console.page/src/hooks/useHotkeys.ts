/**
 * useHotkeys.ts —— 全局快捷键。
 * 统一在这里注册，避免各组件各写一份 keydown 监听互相打架。
 */
import { useEffect } from 'react';

export interface Hotkey {
    /** 形如 'mod+k' / 'shift+escape' / '/'，mod = Ctrl(⌘) */
    combo: string;
    handler: (event: KeyboardEvent) => void;
    /** 输入框聚焦时是否依然生效，默认 false */
    allowInInput?: boolean;
    enabled?: boolean;
}

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (EDITABLE.has(target.tagName)) return true;
    return target.isContentEditable;
}

function matches(event: KeyboardEvent, combo: string): boolean {
    const parts = combo.toLowerCase().split('+');
    const key = parts.find((p) => !['mod', 'ctrl', 'meta', 'shift', 'alt'].includes(p));
    if (!key) return false;
    const wantMod = parts.includes('mod') || parts.includes('ctrl') || parts.includes('meta');
    const wantShift = parts.includes('shift');
    const wantAlt = parts.includes('alt');

    const mod = event.ctrlKey || event.metaKey;
    if (wantMod !== mod) return false;
    if (wantShift !== event.shiftKey) return false;
    if (wantAlt !== event.altKey) return false;

    const eventKey = event.key.toLowerCase();
    if (key === 'escape') return eventKey === 'escape';
    if (key === '/') return eventKey === '/' || eventKey === '?';
    return eventKey === key;
}

export function useHotkeys(hotkeys: Hotkey[]): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            for (const hotkey of hotkeys) {
                if (hotkey.enabled === false) continue;
                if (!matches(event, hotkey.combo)) continue;
                if (!hotkey.allowInInput && isEditable(event.target)) continue;
                event.preventDefault();
                hotkey.handler(event);
                return;
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [hotkeys]);
}

export { isMac, kbdLabel as comboLabel } from '@/lib/platform';
