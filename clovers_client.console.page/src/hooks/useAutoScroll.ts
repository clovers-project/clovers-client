/**
 * useAutoScroll.ts —— 聊天窗口的「贴底」行为。
 *
 * 规则：用户停留在底部时新消息自动跟随；一旦往上翻，就不再打扰，
 * 改为显示「有新消息」提示，直到用户自己回到底部。
 *
 * 额外用 ResizeObserver 盯住内容高度：
 * 图片是懒加载的，加载完成会把内容撑高，如果不重新贴底，
 * 用户就会看到「列表没有滚到底」的错位现象。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const THRESHOLD = 96;

export function useAutoScroll<T extends HTMLElement>(signature: unknown) {
    const ref = useRef<T | null>(null);
    const [atBottom, setAtBottom] = useState(true);
    const [hasNew, setHasNew] = useState(false);
    const firstRender = useRef(true);
    // 给 ResizeObserver 用的镜像，避免它随 atBottom 反复重建
    const atBottomRef = useRef(true);

    const setBottom = useCallback((value: boolean) => {
        atBottomRef.current = value;
        setAtBottom(value);
    }, []);

    const scrollToBottom = useCallback(
        (behavior: ScrollBehavior = 'smooth') => {
            const el = ref.current;
            if (!el) return;
            el.scrollTo({ top: el.scrollHeight, behavior });
            setHasNew(false);
            setBottom(true);
        },
        [setBottom],
    );

    /**
     * 跟随新消息时直接跳到底部。
     *
     * 这里刻意不用 smooth：新增消息触发的滚动必须是「瞬时且确定」的，
     * 否则在低性能设备或标签页被节流时，动画会卡在半路，
     * 用户看到的就是「列表没有滚到底」。需要动画的场景（点「回到最新」）
     * 走 scrollToBottom('smooth')。
     */
    const followBottom = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        setHasNew(false);
        setBottom(true);
    }, [setBottom]);

    const onScroll = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        const bottom = distance <= THRESHOLD;
        setBottom(bottom);
        if (bottom) setHasNew(false);
    }, [setBottom]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [onScroll]);

    // 内容（尤其是图片）变高时，如果用户原本就贴在底部，就继续保持贴底
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const target = el.firstElementChild ?? el;
        const observer = new ResizeObserver(() => {
            if (!atBottomRef.current) return;
            el.scrollTop = el.scrollHeight;
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, []);

    // 首次挂载直接跳到底部，之后按用户位置决定
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            scrollToBottom('auto');
            return;
        }
        if (atBottomRef.current) followBottom();
        else setHasNew(true);
        // signature 变化代表消息列表变了
    }, [signature, followBottom]);

    return { ref, atBottom, hasNew, scrollToBottom };
}
