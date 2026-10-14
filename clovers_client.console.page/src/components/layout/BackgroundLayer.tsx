import { useSettings } from '@/store/settings';
import { useBackground } from '@/store/background';

/**
 * 自定义背景图。
 *
 * 结构有意分成两层：
 *   .page-backdrop —— 图片本身，单独承担模糊（模糊会把边缘吃掉，所以放大 6%）
 *   .page-scrim    —— 压暗/压亮的遮罩，保证上层文字始终有足够对比度
 * 面板的透明度另外由 --panel-alpha 控制（见 store/settings.ts 的 applyAppearance）。
 */
export function BackgroundLayer() {
    const url = useBackground((s) => s.url);
    const enabled = useSettings((s) => s.appearance.background.enabled);
    const blur = useSettings((s) => s.appearance.background.blur);
    const dim = useSettings((s) => s.appearance.background.dim);
    const mode = useSettings((s) => s.appearance.mode);
    const systemDark = useSettings((s) => s.systemDark);

    const active = enabled && Boolean(url);
    const dark = mode === 'system' ? systemDark : mode === 'dark';

    return (
        <>
            <div
                className="page-backdrop"
                aria-hidden
                style={
                    active && url
                        ? { backgroundImage: `url("${url}")`, filter: `blur(${blur}px)` }
                        : undefined
                }
            />
            <div
                className="page-scrim"
                aria-hidden
                style={
                    active
                        ? {
                              // 暗色模式下用黑遮罩、亮色模式下用白遮罩，
                              // 两者都是「让前景更清楚」，但方向相反
                              backgroundColor: dark
                                  ? `rgb(0 0 0 / ${dim})`
                                  : `rgb(255 255 255 / ${Math.min(0.85, dim * 0.9)})`,
                          }
                        : undefined
                }
            />
        </>
    );
}
