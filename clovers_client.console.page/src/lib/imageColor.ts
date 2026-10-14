/**
 * imageColor.ts —— 从图片里提取主题色。
 *
 * 目标不是「精确的主色提取」，而是给出一套**好看且稳定**的主题色：
 *   1. 缩小到 64×64 采样，够快也够准
 *   2. 丢掉接近纯黑/纯白/灰的像素，它们对「主题色」没有意义
 *   3. 按彩度和明度加权，投到 24 个色相桶里（每桶 15°）
 *   4. 取权重最高的桶，并把相邻桶一起做圆周平均，避免色相跳变
 *
 * 顺带还会给出整张图的平均明度，用来建议亮色还是暗色模式。
 */

export interface ExtractedPalette {
    /** 0–360 的色相 */
    hue: number;
    /** 0–1 的彩度（提取结果的平均值，用于参考） */
    saturation: number;
    /** 0–1 的平均明度 */
    lightness: number;
    /** 加权主色的十六进制表示，用于在设置里给个色块 */
    hex: string;
    /** 整张图偏暗 → 建议用暗色模式 */
    suggestDark: boolean;
}

const SAMPLE_SIZE = 64;
const HUE_BUCKETS = 24;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let rgb: [number, number, number] = [0, 0, 0];
    if (hp < 1) rgb = [c, x, 0];
    else if (hp < 2) rgb = [x, c, 0];
    else if (hp < 3) rgb = [0, c, x];
    else if (hp < 4) rgb = [0, x, c];
    else if (hp < 5) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    const m = l - c / 2;
    return (
        '#' +
        rgb
            .map((v) =>
                Math.round(Math.min(1, Math.max(0, v + m)) * 255)
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('')
    );
}

async function toBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(blob);
        } catch {
            /* 某些浏览器对 SVG 之类不支持，退回 <img> */
        }
    }
    const url = URL.createObjectURL(blob);
    try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('图片解码失败'));
            img.src = url;
        });
    } finally {
        // 图片已经解码进内存，URL 可以立刻释放
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}

export async function extractPalette(blob: Blob): Promise<ExtractedPalette | null> {
    let source: ImageBitmap | HTMLImageElement;
    try {
        source = await toBitmap(blob);
    } catch (err) {
        console.warn('[imageColor] 无法解码图片', err);
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    try {
        ctx.drawImage(source as CanvasImageSource, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    } catch (err) {
        console.warn('[imageColor] 绘制失败', err);
        return null;
    }
    if ('close' in source && typeof source.close === 'function') source.close();

    let data: Uint8ClampedArray;
    try {
        data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    } catch {
        // 理论上不会发生（图片来自本地文件，画布没被污染）
        return null;
    }

    const buckets = new Array<number>(HUE_BUCKETS).fill(0);
    const bucketHue = new Array<number>(HUE_BUCKETS).fill(0);
    const bucketSat = new Array<number>(HUE_BUCKETS).fill(0);
    let totalLightness = 0;
    let counted = 0;
    let chromaTotal = 0;
    let weightedHueX = 0;
    let weightedHueY = 0;

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 128) continue;
        const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        totalLightness += l;
        counted += 1;
        chromaTotal += s;

        // 近黑、近白、灰：对「主题色」没有参考价值
        if (l < 0.1 || l > 0.94 || s < 0.12) continue;

        // 中间明度的颜色最能代表图片气质
        const weight = Math.pow(s, 1.4) * (1 - Math.abs(l - 0.5) * 1.2);
        if (weight <= 0) continue;
        const index = Math.min(HUE_BUCKETS - 1, Math.floor((h / 360) * HUE_BUCKETS));
        buckets[index] += weight;
        bucketHue[index] += h * weight;
        bucketSat[index] += s * weight;
        weightedHueX += Math.cos((h * Math.PI) / 180) * weight;
        weightedHueY += Math.sin((h * Math.PI) / 180) * weight;
    }

    if (counted === 0) return null;

    const avgLightness = totalLightness / counted;
    const avgSaturation = chromaTotal / counted;

    let best = -1;
    let bestWeight = 0;
    buckets.forEach((weight, index) => {
        if (weight > bestWeight) {
            bestWeight = weight;
            best = index;
        }
    });

    let hue: number;
    let saturation: number;
    if (best === -1 || bestWeight === 0) {
        // 整张图没有什么彩色：退回用「所有颜色的合成色相」，通常就是个中性色
        hue = ((Math.atan2(weightedHueY, weightedHueX) * 180) / Math.PI + 360) % 360;
        saturation = avgSaturation;
    } else {
        // 把获胜桶和左右邻居一起做圆周平均，避免 15° 边界造成的跳变
        let x = 0;
        let y = 0;
        let weightSum = 0;
        let satSum = 0;
        for (let offset = -1; offset <= 1; offset++) {
            const index = (best + offset + HUE_BUCKETS) % HUE_BUCKETS;
            const weight = buckets[index];
            if (weight === 0) continue;
            const meanHue = bucketHue[index] / weight;
            x += Math.cos((meanHue * Math.PI) / 180) * weight;
            y += Math.sin((meanHue * Math.PI) / 180) * weight;
            satSum += bucketSat[index];
            weightSum += weight;
        }
        hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
        saturation = weightSum > 0 ? satSum / weightSum : avgSaturation;
    }

    // 提取出的颜色有点「脏」时，把彩度抬到最低可用值，主题才不至于灰扑扑
    const boosted = Math.min(0.22, Math.max(0.08, saturation * 0.85));

    return {
        hue: Math.round(hue),
        saturation: boosted,
        lightness: avgLightness,
        hex: hslToHex(hue, boosted, avgLightness < 0.5 ? 0.62 : 0.52),
        suggestDark: avgLightness < 0.5,
    };
}
