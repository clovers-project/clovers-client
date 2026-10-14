import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import { copyText } from '@/lib/download';
import { toast } from '@/store/ui';

/**
 * Markdown 渲染器。
 *
 * 用 marked 的自定义 renderer 把代码块包成「语言标签 + 复制按钮 + 代码」三段，
 * 这样复制按钮的点击可以用事件委托统一处理（比每条消息挂监听省得多）。
 *
 * 代码高亮按需注册语言：直接用 `highlight.js` 全量入口会打进 ~900KB，
 * 下面这份清单是聊天场景里最常用的，需要更多语言往 LANGUAGES 里加一行即可。
 */
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import lua from 'highlight.js/lib/languages/lua';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const LANGUAGES: Record<string, Parameters<typeof hljs.registerLanguage>[1]> = {
    bash,
    c,
    cpp,
    csharp,
    css,
    diff,
    go,
    ini,
    java,
    javascript,
    json,
    kotlin,
    lua,
    markdown,
    php,
    plaintext,
    powershell,
    python,
    ruby,
    rust,
    scss,
    shell,
    sql,
    swift,
    typescript,
    xml,
    yaml,
};

// 常见别名，让 ```js / ```ts / ```html 这类写法也能高亮
const ALIASES: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'xml',
    vue: 'xml',
    svg: 'xml',
    sh: 'bash',
    zsh: 'bash',
    console: 'bash',
    py: 'python',
    yml: 'yaml',
    cs: 'csharp',
    'c++': 'cpp',
    'c#': 'csharp',
    ps1: 'powershell',
    text: 'plaintext',
    txt: 'plaintext',
    toml: 'ini',
    conf: 'ini',
};

Object.entries(LANGUAGES).forEach(([name, definition]) => hljs.registerLanguage(name, definition));

function resolveLanguage(lang?: string): string {
    if (!lang) return 'plaintext';
    const key = lang.toLowerCase();
    const resolved = ALIASES[key] ?? key;
    return hljs.getLanguage(resolved) ? resolved : 'plaintext';
}

const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = resolveLanguage(lang);
    let highlighted: string;
    try {
        highlighted = hljs.highlight(text, { language }).value;
    } catch {
        highlighted = escapeHtml(text);
    }
    const label = lang || 'text';
    return (
        `<div class="code-block-head"><span>${escapeHtml(label)}</span>` +
        `<button type="button" class="code-copy" data-copy>复制</button></div>` +
        `<pre class="code-block" data-lang="${escapeHtml(label)}"><code class="hljs">${highlighted}</code></pre>`
    );
};

renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escapeHtml(title)}"` : ''}>${text}</a>`;

marked.setOptions({ gfm: true, breaks: true });
marked.use({ renderer });

/** 把 @提及 前缀渲染得醒目一些（保持纯文本，因为 @ 后面是用户ID） */
export function Markdown({ text, className }: { text: string; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);

    const html = useMemo(() => {
        try {
            return marked.parse(text, { async: false }) as string;
        } catch (err) {
            console.error('[markdown] 渲染失败', err);
            return escapeHtml(text).replace(/\n/g, '<br/>');
        }
    }, [text]);

    // 代码复制：委托到容器上，一个监听管所有代码块
    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const onClick = async (event: MouseEvent) => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
            if (!button) return;
            event.stopPropagation();
            const code = button.parentElement?.nextElementSibling?.querySelector('code');
            if (!code) return;
            const ok = await copyText(code.textContent ?? '');
            const original = button.textContent;
            button.textContent = ok ? '已复制' : '复制失败';
            if (!ok) toast.error('复制失败', '浏览器拒绝了剪贴板访问');
            window.setTimeout(() => {
                button.textContent = original ?? '复制';
            }, 1600);
        };
        root.addEventListener('click', onClick);
        return () => root.removeEventListener('click', onClick);
    }, []);

    return (
        <div
            ref={ref}
            className={`md-body ${className ?? ''}`}
            // 内容来自 marked 渲染结果 + 本地会话，与旧版一致地按可信内容处理
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
