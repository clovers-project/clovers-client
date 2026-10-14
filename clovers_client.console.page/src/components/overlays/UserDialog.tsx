import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { PERMISSION_LABEL, type Permission, type UserInfo } from '@/types/protocol';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { getClient } from '@/store/bridge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { Field, inputClass } from '@/components/ui/Controls';
import { cn } from '@/lib/cn';

const PERMISSIONS: Permission[] = ['SuperUser', 'Owner', 'Admin', 'Member'];

export function UserDialog({ onClose }: { onClose: () => void }) {
    const users = useSession((s) => s.users);
    const currentUserId = useSession((s) => s.currentUserId);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<UserInfo | null>(null);
    const [error, setError] = useState('');

    const startEdit = (user: UserInfo) => {
        setEditingId(user.userId);
        setDraft({ ...user });
        setError('');
    };

    const save = () => {
        if (!draft || !editingId) return;
        const session = useSession.getState();
        const nextId = draft.userId.trim();
        const nextName = draft.userName.trim();
        if (!nextId || !nextName) {
            setError('用户 ID 与名称都不能为空');
            return;
        }
        if (nextId !== editingId && session.users.some((u) => u.userId === nextId)) {
            setError('该用户 ID 已存在');
            return;
        }
        if (nextId !== editingId) {
            session.removeUser(editingId);
            session.upsertUser({ ...draft, userId: nextId, userName: nextName });
            if (session.currentUserId === editingId) session.selectUser(nextId);
        } else {
            session.updateUser(editingId, {
                userName: nextName,
                avatar: draft.avatar,
                permission: draft.permission,
            });
        }
        setEditingId(null);
        setDraft(null);
        toast.success('身份信息已保存');
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
            title="身份管理"
            description="身份决定消息以谁的名义发出，以及携带的权限标记"
            width="md"
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">共 {users.length} 个身份</span>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="danger"
                            icon={<Trash2 size={13} />}
                            onClick={() => {
                                if (!window.confirm('清空除当前身份以外的所有身份？')) return;
                                useSession.getState().clearUsers();
                                toast.success('已清理其他身份');
                            }}
                        >
                            清理其他
                        </Button>
                        <Button
                            size="sm"
                            variant="primary"
                            icon={<Plus size={14} />}
                            onClick={() => startEdit(useSession.getState().addBlankUser())}
                        >
                            新建身份
                        </Button>
                    </div>
                </div>

                <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                    {users.map((user) => {
                        const editing = editingId === user.userId;
                        const isCurrent = user.userId === currentUserId;
                        return (
                            <li
                                key={user.userId}
                                className={cn(
                                    'rounded-[var(--r-md)] border px-3 py-2.5 transition-colors',
                                    editing
                                        ? 'border-accent bg-accentsoft'
                                        : 'border-line bg-surface2',
                                )}
                            >
                                {editing && draft ? (
                                    <div className="space-y-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <Field label="用户名称">
                                                <input
                                                    className={inputClass}
                                                    value={draft.userName}
                                                    autoFocus
                                                    onChange={(e) =>
                                                        setDraft({
                                                            ...draft,
                                                            userName: e.target.value,
                                                        })
                                                    }
                                                />
                                            </Field>
                                            <Field label="用户 ID" hint="必须唯一，作为发送者标识">
                                                <input
                                                    className={inputClass}
                                                    value={draft.userId}
                                                    onChange={(e) =>
                                                        setDraft({ ...draft, userId: e.target.value })
                                                    }
                                                />
                                            </Field>
                                        </div>
                                        <Field label="权限">
                                            <select
                                                className={inputClass}
                                                value={draft.permission}
                                                onChange={(e) =>
                                                    setDraft({
                                                        ...draft,
                                                        permission: e.target.value as Permission,
                                                    })
                                                }
                                            >
                                                {PERMISSIONS.map((permission) => (
                                                    <option key={permission} value={permission}>
                                                        {PERMISSION_LABEL[permission]}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="头像 URL">
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
                                            seed={user.userId}
                                            name={user.userName}
                                            src={user.avatar}
                                            size={34}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-2 truncate text-sm font-medium">
                                                {user.userName}
                                                <span className="rounded-[var(--r-xs)] bg-surface px-1.5 py-px text-[10px] text-muted">
                                                    {PERMISSION_LABEL[user.permission]}
                                                </span>
                                            </p>
                                            <p className="truncate text-[11px] text-subtle">
                                                ID {user.userId}
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
                                                onClick={() => {
                                                    useSession
                                                        .getState()
                                                        .selectUser(user.userId);
                                                    toast.success(`已切换身份：${user.userName}`);
                                                }}
                                            >
                                                切换
                                            </Button>
                                        )}
                                        <IconButton
                                            size="sm"
                                            icon={<Pencil size={14} />}
                                            tip="编辑"
                                            onClick={() => startEdit(user)}
                                        />
                                        <IconButton
                                            size="sm"
                                            variant="danger"
                                            icon={<Trash2 size={14} />}
                                            tip="删除身份"
                                            disabled={users.length <= 1}
                                            onClick={() => {
                                                useSession.getState().removeUser(user.userId);
                                                toast.success('身份已删除');
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
