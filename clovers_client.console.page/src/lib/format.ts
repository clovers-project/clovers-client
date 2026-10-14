/** format.ts —— 时间与文本格式化 */

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${formatTime(ts)}`;
}

/** 用于会话列表的「刚刚 / 12:30 / 昨天 / 03-14」 */
export function formatRelative(ts: number): string {
    const now = new Date();
    const d = new Date(ts);
    const sameDay = now.toDateString() === d.toDateString();
    if (sameDay) return formatTime(ts);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === d.toDateString()) return '昨天';
    if (now.getFullYear() === d.getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 日期分隔条文案 */
export function formatDayLabel(ts: number): string {
    const now = new Date();
    const d = new Date(ts);
    if (now.toDateString() === d.toDateString()) return '今天';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === d.toDateString()) return '昨天';
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    const sameYear = now.getFullYear() === d.getFullYear();
    const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return `${sameYear ? `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日` : base} ${weekday}`;
}

export function isSameDay(a: number, b: number): boolean {
    const x = new Date(a);
    const y = new Date(b);
    return (
        x.getFullYear() === y.getFullYear() &&
        x.getMonth() === y.getMonth() &&
        x.getDate() === y.getDate()
    );
}

/** 列表里的单行摘要：去掉换行、压掉 Markdown 噪音 */
export function summarize(text: string, limit = 60): string {
    const flat = text
        .replace(/```[\s\S]*?```/g, '[代码]')
        .replace(/[*_`>#~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!flat) return '';
    return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

/** 截断长 ID 便于展示 */
export function shortId(id: string, keep = 6): string {
    if (id.length <= keep * 2 + 1) return id;
    return `${id.slice(0, keep)}…${id.slice(-keep)}`;
}

export function pluralizeCount(n: number, max = 99): string {
    return n > max ? `${max}+` : String(n);
}
