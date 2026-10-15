/**
 * settings.ts —— 外观与偏好设置。
 *
 * 设计要点：
 * 1. 真正的「渲染」只有一件事——把设置写到 <html> 的 data-* 属性与几个 CSS 变量上，
 *    其余交给 CSS。所以切换主题是零重渲染的。
 * 2. index.html 里有一段等价的内联脚本做首屏防闪烁，改动这里的默认值时
 *    记得同步那边（见 docs/THEMING.md）。
 */
import { create } from 'zustand';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AutoThemeMode = 'light' | 'dark' | 'keep';

export type PaletteId =
    | 'indigo'
    | 'ocean'
    | 'mint'
    | 'forest'
    | 'amber'
    | 'rose'
    | 'violet'
    | 'graphite'
    /** 色相由背景图提取而来，写在 --accent-h 上 */
    | 'auto';

/** 直角（Windows 10 那种直棱直角 + 扁平）还是圆润（卡片感） */
export type CornerStyle = 'square' | 'round';

export type Density = 'comfortable' | 'compact';

export interface BackgroundSettings {
    enabled: boolean;
    /** 背景图模糊半径，px */
    blur: number;
    /** 压暗遮罩强度 0–0.85，数值越大文字越清晰 */
    dim: number;
    /** 面板不透明度 0.3–1，越小背景图透出越多 */
    panelAlpha: number;
    /** 换图时自动从图片里提取主题色 */
    autoTheme: boolean;
}

export interface Appearance {
    mode: ThemeMode;
    palette: PaletteId;
    corner: CornerStyle;
    density: Density;
    /** 根字号，单位 px。整体缩放靠它，而不是逐个改字号 */
    fontSize: number;
    glass: boolean;
    /** palette === 'auto' 时实际使用的色相 */
    autoHue: number;
    autoMode: AutoThemeMode;
    background: BackgroundSettings;
}

export interface Preferences {
    /** true = Enter 发送；false = Ctrl/⌘+Enter 发送 */
    sendWithEnter: boolean;
    /** 桌面通知 */
    notify: boolean;
    /** 收到其他会话的消息时播放提示音（需要用户已与页面交互过） */
    soundOnMessage: boolean;
}

export const PALETTES: { id: PaletteId; name: string; hue: number; chroma: number }[] = [
    { id: 'indigo', name: '靛蓝', hue: 268, chroma: 0.17 },
    { id: 'ocean', name: '海蓝', hue: 232, chroma: 0.16 },
    { id: 'mint', name: '薄荷', hue: 168, chroma: 0.14 },
    { id: 'forest', name: '森绿', hue: 148, chroma: 0.15 },
    { id: 'amber', name: '琥珀', hue: 68, chroma: 0.15 },
    { id: 'rose', name: '玫红', hue: 12, chroma: 0.17 },
    { id: 'violet', name: '紫罗兰', hue: 312, chroma: 0.16 },
    { id: 'graphite', name: '石墨', hue: 255, chroma: 0.02 },
];

export const AUTO_PALETTE_ID: PaletteId = 'auto';

/** 主题色圆点用的 CSS 颜色（chroma 要和 themes.css 里的 --accent-c 保持一致） */
export function paletteSwatch(palette: { hue: number; chroma: number }, lightness = 0.66): string {
    return `oklch(${lightness} ${palette.chroma} ${palette.hue})`;
}

export const FONT_SIZES = [14, 15, 17, 19];

export const DEFAULT_APPEARANCE: Appearance = {
    mode: 'system',
    palette: 'mint',
    corner: 'round',
    density: 'comfortable',
    fontSize: 15,
    glass: false,
    autoHue: 268,
    autoMode: "keep",
    background: {
        enabled: false,
        blur: 12,
        dim: 0.32,
        panelAlpha: 0.72,
        autoTheme: true,
    },
};

export const DEFAULT_PREFERENCES: Preferences = {
    sendWithEnter: true,
    notify: false,
    soundOnMessage: false,
};

interface SettingsState {
    appearance: Appearance;
    preferences: Preferences;
    /** mode='system' 时系统当前是亮还是暗 */
    systemDark: boolean;
    setAppearance: (patch: Partial<Appearance>) => void;
    setBackground: (patch: Partial<BackgroundSettings>) => void;
    setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
    resetAppearance: () => void;
    setSystemDark: (dark: boolean) => void;
}

/**
 * 把外观设置写进 DOM —— 这是唯一影响渲染的地方。
 * 注意：背景图的 URL 不在这里设置，由 store/background.ts 负责，
 * 因为那需要从 IndexedDB 读 Blob。
 */
export function applyAppearance(appearance: Appearance, systemDark: boolean): void {
    const root = document.documentElement;
    const resolved = appearance.autoMode === 'keep' ? appearance.mode === 'system' ? (systemDark ? 'dark' : 'light') : appearance.mode : appearance.autoMode;
    root.dataset.mode = resolved;
    root.dataset.palette = appearance.palette;
    root.dataset.corner = appearance.corner;
    root.dataset.density = appearance.density;
    root.dataset.glass = appearance.glass ? 'on' : 'off';
    root.dataset.bg = appearance.background.enabled ? 'on' : 'off';

    root.style.setProperty('--app-font-size', `${appearance.fontSize}px`);
    root.style.setProperty('--panel-alpha', String(appearance.background.panelAlpha));
    // auto 主题色：色相直接写成一个行内变量，themes.css 里只需要提供彩度
    if (appearance.palette === AUTO_PALETTE_ID) {
        root.style.setProperty('--accent-h', String(appearance.autoHue));
    } else {
        root.style.removeProperty('--accent-h');
    }

    // 让浏览器地址栏 / 原生控件也跟随
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', resolved);
}

const initialSystemDark =
    typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : true;

/** 合并存储值时要把嵌套的 background 也补齐，否则老数据会缺字段 */
function loadAppearance(): Appearance {
    const stored = readJSON<Partial<Appearance>>(KEYS.appearance, {});
    return {
        ...DEFAULT_APPEARANCE,
        ...stored,
        background: { ...DEFAULT_APPEARANCE.background, ...(stored.background ?? {}) },
    };
}

const storedAppearance = loadAppearance();
const storedPreferences = { ...DEFAULT_PREFERENCES, ...readJSON(KEYS.preferences, {}) };

export const useSettings = create<SettingsState>((set, get) => ({
    appearance: storedAppearance,
    preferences: storedPreferences,
    systemDark: initialSystemDark,

    setAppearance: (patch) => {
        const appearance = { ...get().appearance, ...patch };
        writeJSON(KEYS.appearance, appearance);
        applyAppearance(appearance, get().systemDark);
        set({ appearance });
    },

    setBackground: (patch) => {
        const appearance = {
            ...get().appearance,
            background: { ...get().appearance.background, ...patch },
        };
        writeJSON(KEYS.appearance, appearance);
        applyAppearance(appearance, get().systemDark);
        set({ appearance });
    },

    setPreference: (key, value) => {
        const preferences = { ...get().preferences, [key]: value };
        writeJSON(KEYS.preferences, preferences);
        set({ preferences });
    },

    resetAppearance: () => {
        // 背景图是用户自己的资源，恢复默认外观时保留它，只把开关关掉
        const next: Appearance = {
            ...DEFAULT_APPEARANCE,
            background: { ...DEFAULT_APPEARANCE.background, enabled: false },
        };
        writeJSON(KEYS.appearance, next);
        applyAppearance(next, get().systemDark);
        set({ appearance: next });
    },

    setSystemDark: (dark) => {
        applyAppearance(get().appearance, dark);
        set({ systemDark: dark });
    },
}));

/** 当前实际生效的明暗（把 system 解析掉） */
export function useResolvedMode(): 'light' | 'dark' {
    const mode = useSettings((s) => s.appearance.mode);
    const systemDark = useSettings((s) => s.systemDark);
    if (mode === 'system') return systemDark ? 'dark' : 'light';
    return mode;
}

/** 启动时同步一次 + 监听系统主题变化 */
export function initSystemThemeWatch(): void {
    applyAppearance(useSettings.getState().appearance, initialSystemDark);
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => useSettings.getState().setSystemDark(e.matches);
    mq.addEventListener('change', handler);
}
