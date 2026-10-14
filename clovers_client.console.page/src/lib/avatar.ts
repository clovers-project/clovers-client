/**
 * avatar.ts —— 没有头像图片时，用「首字母 + 确定性渐变色」生成占位头像。
 * 同一个 ID 永远得到同一组颜色，视觉上稳定且无需后端参与。
 */

/** 把任意字符串散列成一个稳定的正整数 */
function hash(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

export function avatarGradient(seed: string): string {
    const h = hash(seed || 'clovers');
    const hue = h % 360;
    const hue2 = (hue + 42 + (h % 30)) % 360;
    return `linear-gradient(135deg, oklch(0.72 0.15 ${hue}) 0%, oklch(0.58 0.17 ${hue2}) 100%)`;
}

/** 取展示用的首字母：中文取首字，英文取单词首字母（最多两个） */
export function initials(name: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return '?';
    if (/[\u4e00-\u9fa5]/.test(trimmed[0])) return trimmed.slice(0, 1);
    const words = trimmed.split(/[\s._-]+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return trimmed.slice(0, 2).toUpperCase();
}

/** 头像兜底：给出 id 与名字，返回 CSS 背景与文字 */
export function avatarFallback(seed: string, name: string) {
    return { background: avatarGradient(seed), label: initials(name) };
}
