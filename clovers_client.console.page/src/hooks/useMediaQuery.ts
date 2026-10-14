/** useMediaQuery.ts —— 订阅 CSS 媒体查询 */
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    );

    useEffect(() => {
        if (!window.matchMedia) return;
        const mq = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        setMatches(mq.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [query]);

    return matches;
}

/** 常用断点：与 CSS 里的 900px 保持一致 */
export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 899px)');
}
