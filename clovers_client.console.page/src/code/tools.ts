export async function cropImageToSquare(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("无法获取 canvas 上下文"));
                return;
            }
            // 取宽高较小值作为方形边长
            const size = Math.min(img.width, img.height);
            const offsetX = (img.width - size) / 2;
            const offsetY = (img.height - size) / 2;

            canvas.width = size;
            canvas.height = size;
            // 绘制裁剪后的方形图片
            ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);

            // 转换为 Blob
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("图片转换失败"));
                }
            }, file.type || "image/png");
        };
        img.onerror = () => reject(new Error("图片加载失败"));
        img.src = URL.createObjectURL(file);
    });
}


export const itemHTML = `
<div class="avatar-status">
    <div class="avatar"></div>
    <div class="status-badge none"></div>
</div>
<div class="itemlist-item-info">
    <strong id="currentUserName"></strong>
    <small id="connectStatus"></small>
</div>
<div class="grow-flex"></div>`;

export function setItem(element: HTMLDivElement,
    avatar: string | null,
    status: "online" | "busy" | "tip" | "none" | null,
    title: string | null,
    info: string | null,
) {
    const avatarElement = element.querySelector('.avatar');
    const titleElement = element.querySelector('strong');
    const infoElement = element.querySelector('small');
    const badge = element.querySelector('.status-badge')
    if (!avatarElement || !titleElement || !infoElement || !badge) return;
    if (avatar) {
        const newAvatar = document.createElement('img');
        newAvatar.src = avatar;
        newAvatar.className = 'avatar';
        avatarElement.replaceWith(newAvatar);
    } else if (avatar === "") {
        const newAvatar = document.createElement('div');
        newAvatar.className = 'avatar';
        avatarElement.replaceWith(newAvatar);
    }
    if (status) { badge.className = `status-badge ${status}`; }
    if (title) { titleElement.textContent = title; }
    if (info) { infoElement.textContent = info; }
}