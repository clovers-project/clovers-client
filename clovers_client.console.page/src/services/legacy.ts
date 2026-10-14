/**
 * legacy.ts —— 旧版聊天记录（HTML 快照）→ 结构化消息 的尽力迁移。
 *
 * 旧版本把每条消息的 outerHTML 拼成一整段 HTML 存进 IndexedDB 的 `histories`。
 * 新版改成结构化存储，所以第一次打开某个会话时会把旧 HTML 解析回消息。
 * 解析不出来的内容会被跳过而不是报错——迁移失败也不该影响正常使用。
 *
 * 迁移完成后旧记录会被删除，`converted` 标记写回 localStorage 以便追溯。
 */
import type { ChatRecord, FeedItem, SystemRecord } from '@/types/protocol';
import { uid } from '@/lib/id';

/** 把旧消息体里的 HTML 尽量还原成 Markdown 文本 */
function htmlToMarkdown(root: Element): string {
    const walk = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // 引用块与图片单独处理，正文里不再重复输出
        if (el.classList.contains('quote-message')) return '';
        if (tag === 'img') return '';

        const children = Array.from(el.childNodes).map(walk).join('');

        switch (tag) {
            case 'br':
                return '\n';
            case 'p':
            case 'div':
                return `${children}\n`;
            case 'h1':
                return `\n# ${children}\n`;
            case 'h2':
                return `\n## ${children}\n`;
            case 'h3':
                return `\n### ${children}\n`;
            case 'h4':
                return `\n#### ${children}\n`;
            case 'h5':
                return `\n##### ${children}\n`;
            case 'h6':
                return `\n###### ${children}\n`;
            case 'strong':
            case 'b':
                return `**${children}**`;
            case 'em':
            case 'i':
                return `*${children}*`;
            case 'code':
                return el.closest('pre') ? children : `\`${children}\``;
            case 'pre':
                return `\n\`\`\`\n${children.replace(/\n$/, '')}\n\`\`\`\n`;
            case 'a': {
                const href = el.getAttribute('href') ?? '';
                return href ? `[${children}](${href})` : children;
            }
            case 'li': {
                const ordered = el.parentElement?.tagName.toLowerCase() === 'ol';
                return `${ordered ? '1.' : '-'} ${children.trim()}\n`;
            }
            case 'blockquote':
                return `\n> ${children.trim().replace(/\n/g, '\n> ')}\n`;
            case 'hr':
                return '\n---\n';
            default:
                return children;
        }
    };

    return walk(root)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * 解析一个会话的旧 HTML 快照。
 * @param html  旧版 chatWindow 的 innerHTML（多条消息拼接）
 * @param fallbackGroupId 消息里没写 data-group-id 时使用的会话 ID
 */
export function parseLegacyHistory(html: string, fallbackGroupId: string): FeedItem[] {
    if (!html?.trim()) return [];
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    } catch {
        return [];
    }

    const items: FeedItem[] = [];
    let seq = 0;
    const base = Date.now();

    doc.querySelectorAll('.message').forEach((el) => {
        const groupId = el.getAttribute('data-group-id') || fallbackGroupId;
        const id = el.id || uid('legacy');

        if (el.classList.contains('system')) {
            const text = el.querySelector('.system-text')?.textContent?.trim() ?? '';
            if (!text) return;
            const rec: SystemRecord = { id, groupId, time: base + seq, text };
            items.push({ kind: 'system', ...rec });
            seq += 1;
            return;
        }

        const content = el.querySelector('.message-content');
        const quote = el.querySelector('.quote-message');
        const images = Array.from(el.querySelectorAll('img.message-image-item'))
            .map((img) => img.getAttribute('src') ?? '')
            .filter(Boolean);

        const record: ChatRecord = {
            id,
            groupId,
            senderId: el.getAttribute('data-sender-id') || 'unknown',
            senderName: el.querySelector('.username')?.textContent?.trim() || '未知用户',
            avatar: (el.querySelector('img.avatar') as HTMLImageElement | null)?.src ?? '',
            permission: 'Member',
            text: content ? htmlToMarkdown(content) : '',
            images,
            at: [],
            reply: quote?.getAttribute('data-ref-id') ?? null,
            // 旧记录没有时间信息，按解析顺序给出递增的近似值
            time: base + seq,
            self: el.classList.contains('self'),
            status: 'sent',
        };
        seq += 1;
        if (!record.text && record.images.length === 0) return;
        items.push({ kind: 'user', ...record });
    });

    return items;
}
