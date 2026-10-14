import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useUi } from '@/store/ui';
import { IconButton } from '@/components/ui/IconButton';

/** 会话内搜索条（Ctrl/⌘ + F 唤起） */
export function SearchBar() {
    const query = useUi((s) => s.searchQuery);
    const setQuery = useUi((s) => s.setSearchQuery);
    const activeIndex = useUi((s) => s.searchActiveIndex);
    const setIndex = useUi((s) => s.setSearchIndex);
    const matchCount = useUi((s) => s.searchMatchCount);
    const setOpen = useUi((s) => s.setSearchOpen);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const step = (delta: number) => {
        if (matchCount === 0) return;
        setIndex((activeIndex + delta + matchCount) % matchCount);
    };

    return (
        <div className="flex shrink-0 animate-fade-up items-center gap-2 border-b border-line bg-surface2 px-[var(--pad-panel)] py-2">
            <Search size={15} className="shrink-0 text-subtle" />
            <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        step(e.shiftKey ? -1 : 1);
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        setOpen(false);
                    }
                }}
                placeholder="在当前会话中搜索…"
                className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-subtle focus:outline-none"
            />
            <span className="shrink-0 tabular-nums text-[11px] text-muted">
                {query.trim() ? `${matchCount === 0 ? 0 : activeIndex + 1} / ${matchCount}` : ''}
            </span>
            <IconButton
                size="sm"
                icon={<ChevronUp size={14} />}
                tip="上一个 (Shift+Enter)"
                onClick={() => step(-1)}
                disabled={matchCount === 0}
            />
            <IconButton
                size="sm"
                icon={<ChevronDown size={14} />}
                tip="下一个 (Enter)"
                onClick={() => step(1)}
                disabled={matchCount === 0}
            />
            <IconButton
                size="sm"
                icon={<X size={14} />}
                tip="关闭 (Esc)"
                onClick={() => setOpen(false)}
            />
        </div>
    );
}
