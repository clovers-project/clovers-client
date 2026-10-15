/**
 * background.ts —— 自定义背景图。
 *
 * 图片本体存在 IndexedDB（Blob），这里只维护一个可渲染的 object URL。
 * 换图时顺手做两件事：
 *   1. 用 lib/imageColor 提取主题色，写进 settings 的 autoHue
 *      （用户开了「跟随背景图」就立刻生效）
 *   2. 如果图片整体偏暗/偏亮，并且用户选的是「跟随系统」，会给出一次提醒
 *      ——但不强行改用户的模式选择
 */
import { create } from 'zustand';
import { ASSET_BACKGROUND, assetsStore } from '@/services/assets';
import { extractPalette } from '@/lib/imageColor';
import { AUTO_PALETTE_ID, useSettings } from './settings';
import { toast } from './ui';

const DARK_THRESHOLD = 0.35;
const LIGHT_THRESHOLD = 0.65;
interface BackgroundState {
    /** 当前背景图的 object URL（没有则为 null） */
    url: string | null;
    /** 最近一次提取出来的主题色，用于设置面板显示色块 */
    extractedHex: string | null;
    loading: boolean;

    /** 应用启动时调用：把已存的图片读出来 */
    restore: () => Promise<void>;
    /** 用户选了新图片 */
    apply: (file: File) => Promise<void>;
    /** 删除背景图并关闭开关 */
    remove: () => Promise<void>;
    /** 重新从当前图片提取主题色 */
    reExtract: () => Promise<void>;
}

let currentObjectUrl: string | null = null;

function revoke() {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
}

export const useBackground = create<BackgroundState>((set, get) => ({
    url: null,
    extractedHex: null,
    loading: false,

    restore: async () => {
        const blob = await assetsStore.get(ASSET_BACKGROUND);
        if (!blob) {
            // 设置里说开着背景图，但资源已经不在了：把开关纠正过来
            if (useSettings.getState().appearance.background.enabled) {
                useSettings.getState().setBackground({ enabled: false });
            }
            return;
        }
        revoke();
        currentObjectUrl = URL.createObjectURL(blob);
        set({ url: currentObjectUrl });
        void get().reExtract();
    },

    apply: async (file) => {
        set({ loading: true });
        try {
            await assetsStore.put(ASSET_BACKGROUND, file);
            revoke();
            currentObjectUrl = URL.createObjectURL(file);
            set({ url: currentObjectUrl });
            useSettings.getState().setBackground({ enabled: true });
            await get().reExtract();
            toast.success('背景图片已更新');
        } catch (err) {
            console.error('[background] 保存失败', err);
            toast.error('背景图片保存失败');
        } finally {
            set({ loading: false });
        }
    },

    remove: async () => {
        await assetsStore.remove(ASSET_BACKGROUND);
        revoke();
        useSettings.getState().setBackground({ enabled: false });
        set({ url: null, extractedHex: null });
        toast.success('已移除背景图片');
    },

    reExtract: async () => {
        const blob = await assetsStore.get(ASSET_BACKGROUND);
        if (!blob) return;
        const palette = await extractPalette(blob);
        if (!palette) return;
        set({ extractedHex: palette.hex });

        const settings = useSettings.getState();
        const { background } = settings.appearance;
        // 记下色相，不管当前有没有启用 auto 主题都存着，用户切过去就立刻生效
        settings.setAppearance({
            autoHue: palette.hue,
            autoMode: palette.lightness > LIGHT_THRESHOLD ? 'light' : palette.lightness < DARK_THRESHOLD ? 'dark' : 'keep',
        });
        if (background.autoTheme && settings.appearance.palette !== AUTO_PALETTE_ID) {
            settings.setAppearance({ palette: AUTO_PALETTE_ID });
        }
    },
}));

/** 「跟随背景图」时，色块要用当前提取到的颜色来画 */
export function useAutoHue(): number {
    return useSettings((s) => s.appearance.autoHue);
}
