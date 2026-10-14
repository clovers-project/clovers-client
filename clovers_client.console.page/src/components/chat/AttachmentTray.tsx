import { X } from 'lucide-react';
import { useUi } from '@/store/ui';

/** 待发送图片的预览条 */
export function AttachmentTray() {
    const attachments = useUi((s) => s.attachments);
    const remove = useUi((s) => s.removeAttachment);
    const openLightbox = useUi((s) => s.openLightbox);

    if (attachments.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 px-1 pb-2">
            {attachments.map((item, index) => (
                <div
                    key={item.id}
                    className="group/att relative animate-pop-in overflow-hidden rounded-[var(--r-md)] border border-line"
                >
                    <button
                        type="button"
                        onClick={() =>
                            openLightbox(
                                attachments.map((a) => a.previewUrl),
                                index,
                            )
                        }
                    >
                        <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="h-20 w-20 object-cover"
                        />
                    </button>
                    <button
                        type="button"
                        aria-label="移除图片"
                        onClick={() => remove(item.id)}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-[var(--r-xs)] bg-black/60 text-white opacity-0 transition-opacity group-hover/att:opacity-100 focus:opacity-100"
                    >
                        <X size={12} />
                    </button>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                        {item.file.name}
                    </span>
                </div>
            ))}
        </div>
    );
}
