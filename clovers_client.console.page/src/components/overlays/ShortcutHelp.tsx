import { Keyboard } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Kbd } from '@/components/ui/Controls';
import { kbdLabel } from '@/lib/platform';

const GROUPS: { title: string; items: { combo: string; desc: string }[] }[] = [
    {
        title: '全局',
        items: [
            { combo: 'mod+k', desc: '打开命令面板' },
            { combo: 'mod+/', desc: '显示这份快捷键说明' },
            { combo: 'mod+,', desc: '打开设置' },
            { combo: 'mod+b', desc: '收起 / 展开会话列表' },
            { combo: 'escape', desc: '关闭当前浮层' },
        ],
    },
    {
        title: '会话',
        items: [
            { combo: 'mod+f', desc: '在当前会话内搜索' },
            { combo: 'mod+shift+k', desc: '清空当前会话记录' },
            { combo: 'mod+shift+e', desc: '导出当前会话' },
            { combo: 'alt+↑', desc: '切换到上一个会话' },
            { combo: 'alt+↓', desc: '切换到下一个会话' },
        ],
    },
    {
        title: '输入框',
        items: [
            { combo: 'enter', desc: '发送消息（可在设置里改键）' },
            { combo: 'shift+enter', desc: '换行' },
            { combo: 'mod+v', desc: '粘贴图片作为附件' },
        ],
    },
];

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
    return (
        <Modal
            open
            onClose={onClose}
            title={
                <span className="flex items-center gap-2">
                    <Keyboard size={16} className="text-accent" />
                    快捷键
                </span>
            }
            description="输入框聚焦时，以 Enter 为主的组合键交由输入框处理"
            width="md"
        >
            <div className="grid gap-6 sm:grid-cols-2">
                {GROUPS.map((group) => (
                    <section key={group.title}>
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                            {group.title}
                        </h3>
                        <ul className="space-y-1.5">
                            {group.items.map((item) => (
                                <li
                                    key={item.combo + item.desc}
                                    className="flex items-center justify-between gap-3 text-sm"
                                >
                                    <span className="min-w-0 text-muted">{item.desc}</span>
                                    <Kbd>{kbdLabel(item.combo)}</Kbd>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </Modal>
    );
}
