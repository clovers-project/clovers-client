/** export.ts —— 会话导出（Markdown / JSON） */
import type { FeedItem, GroupInfo } from '@/types/protocol';
import { formatDateTime } from './format';
import { resolveUserName } from '@/store/session';

export function feedToMarkdown(group: GroupInfo, items: FeedItem[]): string {
    const lines: string[] = [
        `# ${group.groupName}`,
        '',
        `> 会话 ID：\`${group.groupId}\`  `,
        `> 导出时间：${formatDateTime(Date.now())}  `,
        `> 消息条数：${items.length}`,
        '',
        '---',
        '',
    ];

    items.forEach((item) => {
        if (item.kind === 'system') {
            lines.push(`*（系统）${item.text}*`, '');
            return;
        }
        const mentions = item.at
            .map((id) => `@${id === '' ? 'BOT' : resolveUserName(id)}`)
            .join(' ');
        lines.push(`### ${item.senderName} · ${formatDateTime(item.time)}`);
        if (mentions) lines.push('', `> 提及：${mentions}`);
        if (item.reply) lines.push('', `> 回复消息 ID：\`${item.reply}\``);
        if (item.text.trim()) lines.push('', item.text.trim());
        if (item.images.length > 0) {
            lines.push('', ...item.images.map((url) => `![图片](${url})`));
        }
        lines.push('');
    });

    return lines.join('\n');
}

export function feedToJSON(group: GroupInfo, items: FeedItem[]): string {
    return JSON.stringify(
        {
            group: { groupId: group.groupId, groupName: group.groupName },
            exportedAt: new Date().toISOString(),
            count: items.length,
            messages: items,
        },
        null,
        2,
    );
}

/** 让文件名在各系统上都合法 */
export function safeFileName(name: string): string {
    return (name || 'conversation').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}
