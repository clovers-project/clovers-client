/**
 * searchHighlight.ts —— 会话内搜索的高亮。
 *
 * 直接在渲染好的 DOM 文本节点上做替换，而不是在 HTML 字符串上做正则替换：
 * 后者很容易把标签属性里的文字也高亮掉，甚至破坏 HTML 结构。
 */
const MARK_TAG = 'MARK';
const HIT_ATTR = 'data-search-hit';

export function clearHighlights(root: HTMLElement): void {
    const marks = root.querySelectorAll<HTMLElement>(`mark[${HIT_ATTR}]`);
    marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
        parent.normalize();
    });
}

/**
 * 高亮所有匹配项，并返回匹配总数。
 * 高亮之后用 focusMatch() 决定哪一项是「当前项」。
 */
export function highlightMatches(root: HTMLElement, query: string): number {
    clearHighlights(root);
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return 0;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const text = node.nodeValue ?? '';
            if (!text.trim()) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest('script,style,button,mark')) return NodeFilter.FILTER_REJECT;
            return text.toLowerCase().includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
    });

    const targets: Text[] = [];
    while (walker.nextNode()) targets.push(walker.currentNode as Text);

    let count = 0;
    targets.forEach((node) => {
        const text = node.nodeValue ?? '';
        const lower = text.toLowerCase();
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        let index = lower.indexOf(needle);
        if (index === -1) return;
        while (index !== -1) {
            if (index > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
            const mark = document.createElement(MARK_TAG);
            mark.setAttribute(HIT_ATTR, String(count));
            mark.textContent = text.slice(index, index + needle.length);
            fragment.appendChild(mark);
            cursor = index + needle.length;
            count += 1;
            index = lower.indexOf(needle, cursor);
        }
        if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
        node.parentNode?.replaceChild(fragment, node);
    });

    return count;
}

/** 滚动到第 index 个匹配项，并给它加上「当前」样式 */
export function focusMatch(root: HTMLElement, index: number): void {
    root.querySelectorAll<HTMLElement>(`mark[${HIT_ATTR}]`).forEach((mark) => {
        mark.classList.remove('is-active');
    });
    const target = root.querySelector<HTMLElement>(`mark[${HIT_ATTR}="${index}"]`);
    if (!target) return;
    target.classList.add('is-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
