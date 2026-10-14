/**
 * cn.ts —— 极简 className 合并工具。
 * 不引入 clsx/tailwind-merge：本项目的类名由自己完全掌控，
 * 真出现冲突时用后面的类覆盖前面的即可（CSS 里已注意优先级）。
 */
export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...values: ClassValue[]): string {
    const out: string[] = [];
    const walk = (v: ClassValue) => {
        if (!v && v !== 0) return;
        if (Array.isArray(v)) {
            v.forEach(walk);
            return;
        }
        out.push(String(v));
    };
    values.forEach(walk);
    return out.join(' ');
}
