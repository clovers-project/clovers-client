import { useRef, useState } from 'react';
import {
    Check,
    Image as ImageIcon,
    Monitor,
    Moon,
    Palette,
    Pipette,
    Pencil,
    Sun,
    Square,
    Squircle,
    Trash2,
    Upload,
} from 'lucide-react';
import {
    AUTO_PALETTE_ID,
    FONT_SIZES,
    PALETTES,
    paletteSwatch,
    useSettings,
    type CornerStyle,
    type Density,
    type PaletteId,
    type ThemeMode,
} from '@/store/settings';
import { useBackground } from '@/store/background';
import { useChat } from '@/store/chat';
import { toast } from '@/store/ui';
import { actions } from '@/store/bridge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Segmented, SectionTitle, Switch, inputClass } from '@/components/ui/Controls';
import { cn } from '@/lib/cn';

const FONT_LABEL: Record<number, string> = {
    14: '小',
    15: '标准',
    17: '大',
    19: '特大',
};

export function AuthTokenField() {
    const authToken = useSettings((s) => s.authToken);
    const setAuthToken = useSettings((s) => s.setAuthToken);
    const saved = Boolean(authToken?.trim());
    /** 唯一的本地状态：编辑中的草稿。null = 不在编辑 */
    const [draft, setDraft] = useState<string | null>(null);
    const editing = draft !== null || !saved;
    const save = () => {
        const token = (draft ?? '').trim();
        if (!token) {
            toast.error('请先输入认证令牌');
            return;
        }
        setAuthToken(token);
        setDraft(null); // 收起编辑态，展示值重新从 store 读
        toast.success('认证令牌已保存');
    };

    const remove = () => {
        setAuthToken('');
        setDraft(null);
        toast.success('认证令牌已删除');
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="password"
                value={draft ?? authToken ?? ''}
                readOnly={!editing}
                autoComplete="off"
                spellCheck={false}
                placeholder={saved ? '已保存' : '请输入认证令牌'}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return; // 别打断中文输入法
                    if (e.key === 'Enter' && editing) save();
                    if (e.key === 'Escape' && draft !== null) setDraft(null);
                }}
                className={cn(inputClass, 'flex-1', !editing && 'cursor-default text-subtle')}
            />
            {editing ? (
                <>
                    {draft !== null && (
                        <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                            取消
                        </Button>
                    )}
                    <Button size="sm" variant="secondary" icon={<Check size={13} />} onClick={save}>
                        保存
                    </Button>
                </>
            ) : (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        icon={<Pencil size={13} />}
                        onClick={() => setDraft(authToken ?? '')}
                    >
                        更换
                    </Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={remove}>
                        删除
                    </Button>
                </>
            )}
        </div>
    );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
    const appearance = useSettings((s) => s.appearance);
    const setAppearance = useSettings((s) => s.setAppearance);
    const setBackgroundSettings = useSettings((s) => s.setBackground);
    const resetAppearance = useSettings((s) => s.resetAppearance);
    const preferences = useSettings((s) => s.preferences);
    const setPreference = useSettings((s) => s.setPreference);
    const clearAll = useChat((s) => s.clearAll);
    const backgroundUrl = useBackground((s) => s.url);
    const extractedHex = useBackground((s) => s.extractedHex);
    const backgroundLoading = useBackground((s) => s.loading);
    const fileRef = useRef<HTMLInputElement>(null);

    const bg = appearance.background;

    return (
        <Modal
            open
            onClose={onClose}
            title={
                <span className="flex items-center gap-2">
                    <Palette size={16} className="text-accent" />
                    外观与偏好
                </span>
            }
            description="所有设置立即生效并保存在本机浏览器"
            width="md"
        >
            <div className="space-y-6">
                {/* ---------- 外观模式 ---------- */}
                <section>
                    <SectionTitle>外观模式</SectionTitle>
                    <Segmented<ThemeMode>
                        className="w-full"
                        value={appearance.mode}
                        onChange={(mode) => setAppearance({ mode })}
                        options={[
                            {
                                value: 'light',
                                label: (
                                    <>
                                        <Sun size={13} /> 亮色
                                    </>
                                ),
                            },
                            {
                                value: 'dark',
                                label: (
                                    <>
                                        <Moon size={13} /> 暗色
                                    </>
                                ),
                            },
                            {
                                value: 'system',
                                label: (
                                    <>
                                        <Monitor size={13} /> 跟随系统
                                    </>
                                ),
                            },
                        ]}
                    />
                </section>

                {/* ---------- 主题色 ---------- */}
                <section>
                    <SectionTitle>主题色</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                        {PALETTES.map((palette) => (
                            <button
                                key={palette.id}
                                type="button"
                                title={palette.name}
                                aria-label={palette.name}
                                onClick={() => setAppearance({ palette: palette.id as PaletteId })}
                                className={cn(
                                    'relative flex size-9 items-center justify-center border transition-transform hover:scale-105',
                                    appearance.palette === palette.id
                                        ? 'border-accent ring-2 ring-[var(--c-accent-ring)]'
                                        : 'border-line',
                                )}
                                style={{ background: paletteSwatch(palette) }}
                            >
                                {appearance.palette === palette.id && (
                                    <Check size={14} className="text-white drop-shadow" />
                                )}
                            </button>
                        ))}

                        {/* 跟随背景图 */}
                        <button
                            type="button"
                            disabled={!backgroundUrl}
                            title={backgroundUrl ? '跟随背景图取色' : '先设置一张背景图片'}
                            aria-label="跟随背景图取色"
                            onClick={() => void actions.extractThemeFromBackground()}
                            className={cn(
                                'relative flex size-9 items-center justify-center border transition-transform',
                                backgroundUrl ? 'hover:scale-105' : 'cursor-not-allowed opacity-40',
                                appearance.palette === AUTO_PALETTE_ID
                                    ? 'border-accent ring-2 ring-[var(--c-accent-ring)]'
                                    : 'border-line',
                            )}
                            style={{
                                background: `oklch(0.66 0.16 ${appearance.autoHue})`,
                            }}
                        >
                            {appearance.palette === AUTO_PALETTE_ID ? (
                                <Check size={14} className="text-white drop-shadow" />
                            ) : (
                                <Pipette size={14} className="text-white drop-shadow" />
                            )}
                        </button>
                    </div>
                    <p className="mt-2 text-[11px] text-subtle">
                        主题色会同时影响整个界面的中性灰阶。用取色器图标可以从背景图里自动提取。
                    </p>
                </section>

                {/* ---------- 背景图片 ---------- */}
                <section>
                    <SectionTitle>背景图片</SectionTitle>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden border border-line bg-surface2">
                                {backgroundUrl ? (
                                    <img
                                        src={backgroundUrl}
                                        alt="背景预览"
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <ImageIcon size={20} className="text-subtle" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        icon={<Upload size={13} />}
                                        loading={backgroundLoading}
                                        onClick={() => fileRef.current?.click()}
                                    >
                                        {backgroundUrl ? '更换图片' : '选择图片'}
                                    </Button>
                                    {backgroundUrl && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            icon={<Trash2 size={13} />}
                                            onClick={() => void actions.removeBackgroundImage()}
                                        >
                                            移除
                                        </Button>
                                    )}
                                </div>
                                <p className="text-[11px] text-subtle">
                                    图片只保存在本机浏览器里，不会上传到服务器
                                    {extractedHex ? ` · 已提取主色 ${extractedHex}` : ''}
                                </p>
                            </div>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (file) void actions.setBackgroundImage(file);
                                }}
                            />
                        </div>

                        <Switch
                            checked={bg.enabled}
                            disabled={!backgroundUrl}
                            onChange={(enabled) => setBackgroundSettings({ enabled })}
                            label="启用背景图"
                            description="开启后界面切换为亚克力质感，面板会半透明"
                        />
                        <Switch
                            checked={bg.autoTheme}
                            disabled={!backgroundUrl}
                            onChange={(autoTheme) => {
                                setBackgroundSettings({ autoTheme });
                                if (autoTheme) void actions.extractThemeFromBackground();
                            }}
                            label="自动从背景图提取主题色"
                            description="换图时自动把主题色调成图片的主色"
                        />

                        {bg.enabled && backgroundUrl && (
                            <>
                                <Slider
                                    label="图片模糊"
                                    value={bg.blur}
                                    min={0}
                                    max={40}
                                    step={1}
                                    suffix="px"
                                    onChange={(blur) => setBackgroundSettings({ blur })}
                                />
                                <Slider
                                    label={appearance.mode === 'light' ? '白色蒙版' : '暗化蒙版'}
                                    value={bg.dim}
                                    min={0}
                                    max={0.85}
                                    step={0.01}
                                    format={(v) => `${Math.round(v * 100)}%`}
                                    onChange={(dim) => setBackgroundSettings({ dim })}
                                />
                                <Slider
                                    label="面板不透明度"
                                    value={bg.panelAlpha}
                                    min={0.25}
                                    max={1}
                                    step={0.01}
                                    format={(v) => `${Math.round(v * 100)}%`}
                                    onChange={(panelAlpha) => setBackgroundSettings({ panelAlpha })}
                                />
                            </>
                        )}
                    </div>
                </section>

                {/* ---------- 排版与密度 ---------- */}
                <section>
                    <SectionTitle>排版与密度</SectionTitle>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm">界面风格</span>
                            <Segmented<CornerStyle>
                                value={appearance.corner}
                                onChange={(corner) => setAppearance({ corner })}
                                options={[
                                    {
                                        value: 'square',
                                        label: (
                                            <>
                                                <Square size={12} /> 直角
                                            </>
                                        ),
                                        tip: 'Windows 10 风格的直棱直角 + 扁平化',
                                    },
                                    {
                                        value: 'round',
                                        label: (
                                            <>
                                                <Squircle size={12} /> 圆润
                                            </>
                                        ),
                                        tip: '圆角卡片风格',
                                    },
                                ]}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm">界面密度</span>
                            <Segmented<Density>
                                value={appearance.density}
                                onChange={(density) => setAppearance({ density })}
                                options={[
                                    { value: 'comfortable', label: '舒适' },
                                    { value: 'compact', label: '紧凑' },
                                ]}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm">字号</span>
                            <Segmented<string>
                                value={String(appearance.fontSize)}
                                onChange={(value) => setAppearance({ fontSize: Number(value) })}
                                options={FONT_SIZES.map((size) => ({
                                    value: String(size),
                                    label: FONT_LABEL[size] ?? String(size),
                                }))}
                            />
                        </div>
                        <Switch
                            checked={appearance.glass}
                            onChange={(glass) => setAppearance({ glass })}
                            label="毛玻璃效果"
                            description="关闭后所有半透明面板改为实色，低性能设备更流畅"
                        />
                    </div>
                </section>

                {/* ---------- 交互偏好 ---------- */}
                <section>
                    <SectionTitle>交互偏好</SectionTitle>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4 py-2.5">
                            <span className="text-sm">发送方式</span>
                            <Segmented<'enter' | 'mod'>
                                value={preferences.sendWithEnter ? 'enter' : 'mod'}
                                onChange={(value) => setPreference('sendWithEnter', value === 'enter')}
                                options={[
                                    { value: 'enter', label: 'Enter 发送' },
                                    { value: 'mod', label: 'Ctrl/⌘ 发送' },
                                ]}
                            />
                        </div>
                        <Switch
                            checked={preferences.notify}
                            onChange={(v) => void actions.setNotify(v)}
                            label="桌面通知"
                            description="其他会话收到新消息时弹出系统通知"
                        />
                        <Switch
                            checked={preferences.soundOnMessage}
                            onChange={(v) => setPreference('soundOnMessage', v)}
                            label="新消息提示音"
                        />
                    </div>
                </section>
                {/* ----------身份验证---------- */}
                <section>
                    <SectionTitle>身份验证</SectionTitle>
                    <AuthTokenField />
                </section>
                {/* ----------身份验证---------- */}
                <section>
                    <SectionTitle>数据</SectionTitle>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                resetAppearance();
                                toast.success('外观已恢复默认');
                            }}
                        >
                            恢复默认外观
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            onClick={async () => {
                                if (
                                    !window.confirm(
                                        '确定要清空所有会话的本地聊天记录吗？此操作不可撤销。',
                                    )
                                )
                                    return;
                                await clearAll();
                                toast.success('已清空全部本地记录');
                            }}
                        >
                            清空全部聊天记录
                        </Button>
                    </div>
                </section>
            </div>
        </Modal>
    );
}

/** 带数值显示的滑块（Win10 的扁平滑块样式，纯 CSS 实现） */
function Slider({
    label,
    value,
    min,
    max,
    step,
    suffix,
    format,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix?: string;
    format?: (value: number) => string;
    onChange: (value: number) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                <span>{label}</span>
                <span className="tabular-nums text-subtle">
                    {format ? format(value) : `${value}${suffix ?? ''}`}
                </span>
            </span>
            <input
                type="range"
                className={cn(inputClass, 'flat-range h-6 cursor-pointer px-0 py-0')}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}

