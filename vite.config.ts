import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 部署在 https://sd762.github.io/hok-training-exam/ 之下，
// 因此正式建置需要子路徑；本機開發維持根路徑。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/hok-training-exam/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
