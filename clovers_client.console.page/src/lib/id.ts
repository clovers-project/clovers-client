/** id.ts —— 本地消息 / 记录的唯一标识 */

export function uid(prefix = 'm'): string {
    const rand =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
