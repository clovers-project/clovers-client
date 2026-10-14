/** platform.ts —— 平台判断与快捷键文案 */

export function isMac(): boolean {
    if (typeof navigator === 'undefined') return false;
    const source = navigator.userAgent || '';
    return /Mac|iPhone|iPad|iPod/.test(source);
}

/** 把 'mod+k' 这类写法渲染成用户看得懂的按键文案 */
export function kbdLabel(combo: string): string {
    const mac = isMac();
    return combo
        .split('+')
        .map((part) => {
            switch (part) {
                case 'mod':
                    return mac ? '⌘' : 'Ctrl';
                case 'shift':
                    return mac ? '⇧' : 'Shift';
                case 'alt':
                    return mac ? '⌥' : 'Alt';
                case 'escape':
                    return 'Esc';
                case 'enter':
                    return 'Enter';
                default:
                    return part.toUpperCase();
            }
        })
        .join(mac ? '' : ' + ');
}
