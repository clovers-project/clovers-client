export const itemHTML = `
<div class="avatar-status">
    <div class="avatar"></div>
    <div class="status-badge none"></div>
</div>
<div class="itemlist-item-info">
    <strong></strong>
    <small></small>
</div>`;

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