import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useUi } from '@/store/ui';
import { IconButton } from '@/components/ui/IconButton';

/** 图片查看器：滚轮缩放、拖拽平移、左右切换、Esc 关闭 */
export function ImageLightbox() {
    const lightbox = useUi((s) => s.lightbox);
    const close = useUi((s) => s.closeLightbox);
    const step = useUi((s) => s.stepLightbox);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    useEffect(() => {
        if (!lightbox) return;
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }, [lightbox]);

    useEffect(() => {
        if (!lightbox) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') step(-1);
            if (e.key === 'ArrowRight') step(1);
            if (e.key === '+' || e.key === '=') setScale((s) => Math.min(6, s * 1.2));
            if (e.key === '-') setScale((s) => Math.max(0.2, s / 1.2));
        };
        document.addEventListener('keydown', onKeyDown);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previous;
        };
    }, [lightbox, close, step]);

    if (!lightbox) return null;
    const current = lightbox.images[lightbox.index];
    const total = lightbox.images.length;

    return createPortal(
        <div
            className="fixed inset-0 z-[var(--z-overlay)] flex flex-col bg-black/88 backdrop-blur-sm"
            onClick={close}
        >
            <header
                className="flex shrink-0 items-center gap-2 px-3 py-2 text-white/90"
                onClick={(e) => e.stopPropagation()}
            >
                <span className="text-xs tabular-nums">
                    {lightbox.index + 1} / {total}
                </span>
                <span className="ml-auto flex items-center gap-1">
                    <IconButton
                        icon={<ZoomOut size={17} />}
                        tip="缩小 (-)"
                        className="text-white/80 hover:bg-white/15 hover:text-white"
                        onClick={() => setScale((s) => Math.max(0.2, s / 1.2))}
                    />
                    <span className="w-12 text-center text-xs tabular-nums">
                        {Math.round(scale * 100)}%
                    </span>
                    <IconButton
                        icon={<ZoomIn size={17} />}
                        tip="放大 (+)"
                        className="text-white/80 hover:bg-white/15 hover:text-white"
                        onClick={() => setScale((s) => Math.min(6, s * 1.2))}
                    />
                    <IconButton
                        icon={<RotateCcw size={17} />}
                        tip="重置视图"
                        className="text-white/80 hover:bg-white/15 hover:text-white"
                        onClick={() => {
                            setScale(1);
                            setOffset({ x: 0, y: 0 });
                        }}
                    />
                    <a
                        href={current}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex size-9 items-center justify-center rounded-[var(--r-sm)] text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                        title="下载原图"
                    >
                        <Download size={17} />
                    </a>
                    <IconButton
                        icon={<X size={17} />}
                        tip="关闭 (Esc)"
                        className="text-white/80 hover:bg-white/15 hover:text-white"
                        onClick={close}
                    />
                </span>
            </header>

            <div
                className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => {
                    const next = scale * (e.deltaY > 0 ? 0.9 : 1.1);
                    setScale(Math.min(6, Math.max(0.2, next)));
                }}
                onPointerDown={(e) => {
                    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                    const drag = dragRef.current;
                    if (!drag) return;
                    setOffset({
                        x: drag.ox + (e.clientX - drag.x),
                        y: drag.oy + (e.clientY - drag.y),
                    });
                }}
                onPointerUp={() => {
                    dragRef.current = null;
                }}
                onDoubleClick={() => {
                    setScale(1);
                    setOffset({ x: 0, y: 0 });
                }}
                style={{ cursor: scale > 1 ? 'grab' : 'default' }}
            >
                <img
                    src={current}
                    alt="查看图片"
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain transition-transform duration-[var(--dur-fast)]"
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                />

                {total > 1 && (
                    <>
                        <button
                            type="button"
                            aria-label="上一张"
                            onClick={() => step(-1)}
                            className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/70"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            type="button"
                            aria-label="下一张"
                            onClick={() => step(1)}
                            className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/70"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </>
                )}
            </div>

            {total > 1 && (
                <div
                    className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    {lightbox.images.map((url, i) => (
                        <button
                            key={`${url}-${i}`}
                            type="button"
                            onClick={() => useUi.getState().openLightbox(lightbox.images, i)}
                            className={
                                i === lightbox.index
                                    ? 'size-11 shrink-0 overflow-hidden rounded-[var(--r-sm)] ring-2 ring-white'
                                    : 'size-11 shrink-0 overflow-hidden rounded-[var(--r-sm)] opacity-50 transition-opacity hover:opacity-100'
                            }
                        >
                            <img src={url} alt="" className="size-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>,
        document.body,
    );
}
