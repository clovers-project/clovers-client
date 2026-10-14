/**
 * main.tsx —— 应用入口。
 * 只做三件事：挂载 React、引入全局样式、在窗口获得焦点时清掉当前会话未读。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { useChat } from './store/chat';
import { useSession } from './store/session';
import { useBackground } from './store/background';

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 挂载点');

createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

// 页面重新获得焦点时，把当前会话的未读清掉
window.addEventListener('focus', () => {
    const groupId = useSession.getState().currentGroupId;
    useChat.getState().markRead(groupId);
});

// 恢复上次设置的背景图（图片存在 IndexedDB 里，是异步的）
void useBackground.getState().restore();

console.info(
    `%c clovers 终端 %c v1.0.0 `,
    'background:#4361ee;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px',
    'background:#222;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px',
);
