import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AtSign, Bot, ImagePlus, Send, Trash2 } from 'lucide-react';
import { useChat } from '@/store/chat';
import { drafts, toast, useUi } from '@/store/ui';
import { useSettings } from '@/store/settings';
import { getClient } from '@/store/bridge';
import { ComposerStatus } from './ComposerStatus';
import { AttachmentTray } from './AttachmentTray';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { mentionCandidates, useCurrentUser } from '@/store/session';

// const EMOJIS = [
//     '😀', '😄', '😁', '😊', '🙂', '😉', '😍', '🤔', '😅', '😂',
//     '🥳', '😴', '😭', '😡', '👍', '👎', '👌', '🙏', '👏', '💪',
//     '🎉', '🔥', '✨', '❤️', '💔', '✅', '❌', '⚠️', '⭐', '🚀',
// ];

export function Composer({ groupId }: { groupId: string }) {
    const [value, setValue] = useState(() => drafts.get(groupId));
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    // const [emojiOpen, setEmojiOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const currentUser = useCurrentUser();
    const replyTo = useUi((s) => s.replyTo);
    const mentions = useUi((s) => s.mentions);
    const atBot = useUi((s) => s.atBot);
    const attachments = useUi((s) => s.attachments);
    const addAttachments = useUi((s) => s.addAttachments);
    const setAtBot = useUi((s) => s.setAtBot);
    const addMention = useUi((s) => s.addMention);
    const resetComposer = useUi((s) => s.resetComposer);
    const sendWithEnter = useSettings((s) => s.preferences.sendWithEnter);
    const authToken = useSettings((s) => s.authToken);;

    const candidates = useMemo(() => {
        if (mentionQuery === null) return [];
        const query = mentionQuery.toLowerCase();
        return mentionCandidates()
            .filter((c) => c.userId !== currentUser.userId)
            .filter((c) => !query || c.userName.toLowerCase().includes(query) || c.userId.toLowerCase().includes(query))
            .slice(0, 6);
    }, [mentionQuery, currentUser.userId]);

    // 切换会话时载入对应草稿
    useEffect(() => {
        setValue(drafts.get(groupId));
        setMentionQuery(null);
        // setEmojiOpen(false);
        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
        }
    }, [groupId]);

    // 自动增高
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    }, [value]);

    const updateValue = (next: string) => {
        setValue(next);
        drafts.save(groupId, next);
    };

    /** 检测光标前是否正在输入 @xxx */
    const syncMentionQuery = (text: string, caret: number) => {
        const before = text.slice(0, caret);
        const match = /@([^\s@]*)$/.exec(before);
        setMentionQuery(match ? match[1] : null);
        setMentionIndex(0);
    };

    const applyMention = (userId: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const caret = el.selectionStart;
        const before = value.slice(0, caret).replace(/@([^\s@]*)$/, '');
        const after = value.slice(caret);
        updateValue(`${before}${after}`);
        addMention(userId);
        setMentionQuery(null);
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(before.length, before.length);
        });
    };

    const send = async () => {
        const text = value.trim();
        const at = [...mentions];
        if (!text && attachments.length === 0) return;
        if (uploading) return;
        if (atBot) at.push('');
        let images: string[] = [];
        if (attachments.length > 0) {
            setUploading(true);
            try {
                images = (await getClient()?.uploadFiles(attachments.map((a) => a.file))) ?? [];
            } finally {
                setUploading(false);
            }
            if (images.length === 0) {
                toast.error('图片上传失败', '请检查网络或稍后重试');
                return;
            }
        }
        useChat.getState().send(text, images, at, replyTo, authToken);
        updateValue('');
        resetComposer();
        // setEmojiOpen(false);
        textareaRef.current?.focus();
    };

    const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        // @提及 候选列表的键盘操作
        if (mentionQuery !== null && candidates.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setMentionIndex((i) => (i + 1) % candidates.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setMentionIndex((i) => (i - 1 + candidates.length) % candidates.length);
                return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                const picked = candidates[mentionIndex];
                applyMention(picked.userId);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                setMentionQuery(null);
                return;
            }
        }

        const isEnter = event.key === 'Enter';
        if (!isEnter) return;
        const withMod = event.ctrlKey || event.metaKey;
        const shouldSend = sendWithEnter ? !event.shiftKey && !withMod : withMod;
        if (!shouldSend) return;
        if (event.nativeEvent.isComposing) return; // 中文输入法组字中不发送
        event.preventDefault();
        void send();
    };

    const pickFiles = (files: FileList | File[] | null) => {
        if (!files) return;
        const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (list.length === 0) {
            toast.warning('只支持图片文件');
            return;
        }
        addAttachments(list);
    };

    return (
        <div
            className={cn(
                'relative shrink-0 border-t border-line bg-surface px-[var(--pad-panel)] pb-[var(--pad-panel)] pt-[var(--pad-composer)]',
                dragging && 'bg-accentsoft',
            )}
            onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
            }}
            onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragging(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFiles(e.dataTransfer.files);
            }}
        >
            {dragging && (
                <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[var(--r-lg)] border-2 border-dashed border-accent bg-surface/85 text-sm font-medium text-accent">
                    松开即可添加图片
                </div>
            )}

            <ComposerStatus groupId={groupId} />
            <AttachmentTray />

            {/* @提及 候选 */}
            {mentionQuery !== null && candidates.length > 0 && (
                <div className="absolute bottom-full left-[var(--pad-panel)] z-20 mb-2 w-64 animate-pop-in overflow-hidden rounded-[var(--r-md)] border border-line bg-elevated shadow-lg">
                    <p className="border-b border-line px-3 py-1.5 text-[11px] text-subtle">
                        选择要 @ 的人 · ↑↓ 切换 · Enter 确认
                    </p>
                    {candidates.map((candidate, index) => (
                        <button
                            key={candidate.userId}
                            type="button"
                            onMouseEnter={() => setMentionIndex(index)}
                            onClick={() => applyMention(candidate.userId)}
                            className={cn(
                                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                                index === mentionIndex ? 'bg-hover' : 'hover:bg-hover',
                            )}
                        >
                            <Avatar
                                seed={candidate.userId}
                                name={candidate.userName}
                                src={candidate.avatar}
                                size={22}
                            />
                            <span className="truncate">{candidate.userName}</span>
                            <span className="ml-auto truncate text-[11px] text-subtle">
                                {candidate.userId}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* 表情面板 */}
            {/* {emojiOpen && (
                <div className="absolute bottom-full right-[var(--pad-panel)] z-20 mb-2 grid w-64 animate-pop-in grid-cols-10 gap-0.5 rounded-[var(--r-md)] border border-line bg-elevated p-2 shadow-lg">
                    {EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                                updateValue(value + emoji);
                                textareaRef.current?.focus();
                            }}
                            className="rounded-[var(--r-xs)] p-1 text-lg leading-none transition-colors hover:bg-hover"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )} */}

            <div className="flex items-end gap-2 rounded-[var(--r-lg)] border border-line bg-surface2 p-2 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-[var(--c-accent-ring)]">
                <div className="flex items-center gap-0.5 pb-0.5">
                    <IconButton
                        icon={<ImagePlus size={17} />}
                        tip="上传图片（也可拖拽 / 粘贴）"
                        onClick={() => fileRef.current?.click()}
                    />
                    {/* <IconButton
                        icon={<Smile size={17} />}
                        tip="表情"
                        active={emojiOpen}
                        onClick={() => setEmojiOpen((v) => !v)}
                    /> */}
                    <IconButton
                        icon={<AtSign size={17} />}
                        tip="提及某人（输入 @ 也可触发）"
                        onClick={() => {
                            const el = textareaRef.current;
                            if (!el) return;
                            const caret = el.selectionStart;
                            if (caret > 0 && value[caret - 1] === '@') { el.focus(); return; }
                            updateValue(`${value.slice(0, caret)}@${value.slice(caret)}`);
                            setMentionQuery('');
                            requestAnimationFrame(() => {
                                el.focus();
                                el.setSelectionRange(caret + 1, caret + 1);
                            });
                        }}
                    />
                    <IconButton
                        icon={<Bot size={17} />}
                        tip="切换 @BOT（机器人会被唤醒）"
                        active={atBot}
                        onClick={() => setAtBot(!atBot)}
                    />
                </div>

                <textarea
                    ref={textareaRef}
                    value={value}
                    rows={1}
                    placeholder={`以 ${currentUser.userName} 的身份发消息…`}
                    onChange={(e) => {
                        updateValue(e.target.value);
                        syncMentionQuery(e.target.value, e.target.selectionStart);
                    }}
                    onClick={(e) =>
                        syncMentionQuery(value, (e.target as HTMLTextAreaElement).selectionStart)
                    }
                    onKeyDown={onKeyDown}
                    onPaste={(e) => {
                        const files = e.clipboardData?.files;
                        if (files && files.length > 0) {
                            e.preventDefault();
                            pickFiles(files);
                        }
                    }}
                    className="max-h-[220px] min-h-[24px] min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-relaxed placeholder:text-subtle focus:outline-none"
                />

                <Button
                    variant="primary"
                    size="md"
                    className="mb-0.5 shrink-0 rounded-[var(--r-md)]"
                    loading={uploading}
                    icon={!uploading ? <Send size={15} /> : undefined}
                    onClick={() => void send()}
                    tip={sendWithEnter ? '发送 (Enter)' : '发送 (Ctrl+Enter)'}
                    tipSide="top"
                >
                    {/* 窄屏只留图标，把宽度让给输入框 */}
                    <span className="max-[640px]:hidden">发送</span>
                </Button>
            </div>

            <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-subtle">
                <span>
                    {sendWithEnter ? 'Enter 发送 · Shift+Enter 换行' : 'Ctrl/⌘ + Enter 发送'}
                    {attachments.length > 0 && ` · ${attachments.length} 张图片待发送`}
                </span>
                <span className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            updateValue('');
                            resetComposer();
                        }}
                        className="inline-flex items-center gap-1 transition-colors hover:text-danger"
                    >
                        <Trash2 size={11} /> 清空草稿
                    </button>
                </span>
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    pickFiles(e.target.files);
                    e.target.value = '';
                }}
            />
        </div>
    );
}
