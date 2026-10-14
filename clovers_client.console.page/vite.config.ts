import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * 后端地址。
 * 开发时 Vite 会把 /ws、/upload、/download、/message 反向代理到该地址，
 * 生产环境下这些路径由部署它的 HTTP 服务自行提供。
 * 可通过环境变量覆盖：CLOVERS_BACKEND=http://127.0.0.1:9000 npm run dev
 */
const backend = process.env.CLOVERS_BACKEND ?? 'http://127.0.0.1:11000'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        proxy: {
            '/ws': { target: backend, ws: true, changeOrigin: true },
            '/upload': { target: backend, changeOrigin: true },
            '/download': { target: backend, changeOrigin: true },
            '/message': { target: backend, changeOrigin: true },
        },
    },
    build: {
        // 部署时把这里改回你的静态目录即可，例如：'../clovers_client/console/page'
        outDir: 'dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
            output: {
                /**
                 * 把体积大且不常变的依赖单独拆包：
                 * 升级业务代码时用户不必重新下载这些 vendor 包。
                 * 只分两块是为了避免 chunk 之间互相引用形成环。
                 */
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (id.includes('highlight.js') || id.includes('marked')) return 'vendor-markdown';
                    return 'vendor';
                },
            },
        },
    },
})
