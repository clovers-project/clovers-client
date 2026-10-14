import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import type { GroupInfo } from '@/types/protocol';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { useChat } from '@/store/chat';
import { actions, getClient } from '@/store/bridge';
import { historyStore } from '@/services/history';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { Field, inputClass } from '@/components/ui/Controls';
import { cn } from '@/lib/cn';

interface Draft {
    groupId: string;
    groupName: string;
    avatar: string;
}

export function GroupDialog({ onClose }: { onClose: () => void }) {
    const groups = useSession((s) => s.groups);
    const currentGroupId = useSession((s) => s.currentGroupId);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState('');
    const clearGroup = useChat((s) => s.clearGroup);

    const startEdit = (group: GroupInfo) => {
        setEditingId(group.groupId);
        setDraft({ groupId: group.groupId, groupName: group.groupName, avatar: group.avatar });
        setError('');
    };

    const save = () => {
        if (!draft || !editingId) return;
        const session = useSession.getState();
        const nextId = draft.groupId.trim();
        const nextName = draft.groupName.trim();
        if (!nextId || !nextName) {
            setError('会话 ID 与名称都不能为空');
            return;
        }
        if (nextId !== editingId && session.groups.some((g) => g.groupId === nextId)) {
            setError('该会话 ID 已存在');
            return;
        }

        if (nextId !== editingId) {
            // 会话 ID 变了：本地历史要跟着搬家，否则切过去就看不到内容
            const items = useChat.getState().feeds[editingId] ?? [];
            useChat.setState((s) => {
                const feeds = { ...s.feeds };
                feeds[nextId] = (feeds[editingId] ?? []).map((item) => ({
                    ...item,
                    groupId: nextId,
                }));
                delete feeds[editingId];
                const summaries = { ...s.summaries };
                if (summaries[editingId]) {
                    summaries[nextId] = summaries[editingId];
                    delete summaries[editingId];
                }
                const unread = { ...s.unread };
                if (unread[editingId]) {
                    unread[nextId] = unread[editingId];
                    delete unread[editingId];
                }
                return { feeds, summaries, unread };
            });
            void (async () => {
                await historyStore.appendMany(
                    nextId,
                    items.map((item) => ({ ...item, groupId: nextId })),
                );
                await historyStore.clear(editingId);
            })();
            session.renameGroup(editingId, nextId, { groupName: nextName, avatar: draft.avatar });
        } else {
            session.updateGroup(editingId, { groupName: nextName, avatar: draft.avatar });
        }

        setEditingId(null);
        setDraft(null);
        toast.success('会话信息已保存');
    };

    const uploadAvatar = async (file: File) => {
        const urls = (await getClient()?.uploadFiles([file])) ?? [];
        if (urls.length === 0) {
            toast.error('头像上传失败');
            return;
        }
        setDraft((d) => (d ? { ...d, avatar: urls[0] } : d));
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="管理会话"
            description="会话 ID 是发给后端的标识，改名不影响已有记录，改 ID 会迁移本地历史"
            width="md"
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">共 {groups.length} 个会话</span>
                    <Button
                        size="sm"
                        variant="primary"
                        icon={<Plus size={14} />}
                        onClick={() => {
                            const group = useSession.getState().addBlankGroup();
                            startEdit(group);
                        }}
                    >
                        新建会话
                    </Button>
                </div>

                <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                    {groups.map((group) => {
                        const editing = editingId === group.groupId;
                        const isCurrent = group.groupId === currentGroupId;
                        return (
                            <li
                                key={group.groupId}
                                className={cn(
                                    'rounded-[var(--r-md)] border px-3 py-2.5 transition-colors',
                                    editing
                                        ? 'border-accent bg-accentsoft'
                                        : 'border-line bg-surface2',
                                )}
                            >
                                {editing && draft ? (
                                    <div className="space-y-3">
                                        <Field label="会话名称">
                                            <input
                                                className={inputClass}
                                                value={draft.groupName}
                                                autoFocus
                                                onChange={(e) =>
                                                    setDraft({ ...draft, groupName: e.target.value })
                                                }
                                            />
                                        </Field>
                                        <Field label="会话 ID" hint="发给后端的标识，必须唯一">
                                            <input
                                                className={inputClass}
                                                value={draft.groupId}
                                                onChange={(e) =>
                                                    setDraft({ ...draft, groupId: e.target.value })
                                                }
                                            />
                                        </Field>
                                        <Field label="会话头像 URL">
                                            <div className="flex gap-2">
                                                <input
                                                    className={inputClass}
                                                    value={draft.avatar}
                                                    placeholder="图片地址，或点击右侧上传"
                                                    onChange={(e) =>
                                                        setDraft({ ...draft, avatar: e.target.value })
                                                    }
                                                />
                                                <label className="inline-flex h-[38px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--r-md)] border border-line bg-surface px-3 text-xs transition-colors hover:bg-hover">
                                                    <Upload size={13} />
                                                    上传
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) void uploadAvatar(file);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </Field>
                                        {error && <p className="text-xs text-danger">{error}</p>}
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                icon={<X size={13} />}
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setDraft(null);
                                                }}
                                            >
                                                取消
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                icon={<Check size={13} />}
                                                onClick={save}
                                            >
                                                保存
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            seed={group.groupId}
                                            name={group.groupName}
                                            src={group.avatar}
                                            size={34}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {group.groupName}
                                            </p>
                                            <p className="truncate text-[11px] text-subtle">
                                                ID {group.groupId}
                                            </p>
                                        </div>
                                        {isCurrent ? (
                                            <span className="shrink-0 rounded-[var(--r-xs)] bg-accentsoft px-2 py-0.5 text-[11px] text-accent">
                                                当前
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    void actions.selectGroupAndLoad(group.groupId)
                                                }
                                            >
                                                切换
                                            </Button>
                                        )}
                                        <IconButton
                                            size="sm"
                                            icon={<Pencil size={14} />}
                                            tip="编辑"
                                            onClick={() => startEdit(group)}
                                        />
                                        <IconButton
                                            size="sm"
                                            variant="danger"
                                            icon={<Trash2 size={14} />}
                                            tip="删除会话及本地记录"
                                            onClick={async () => {
                                                if (
                                                    !window.confirm(
                                                        `删除会话「${group.groupName}」及其本地记录？`,
                                                    )
                                                )
                                                    return;
                                                await clearGroup(group.groupId);
                                                useSession.getState().removeGroup(group.groupId);
                                                toast.success('会话已删除');
                                            }}
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </Modal>
    );
}
