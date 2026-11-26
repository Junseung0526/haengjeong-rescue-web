import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// 백엔드에 CORS 설정이 없으므로 개발 서버가 /api를 백엔드로 넘긴다.
// 대상은 API_URL (셸 환경변수 또는 .env.local), 없으면 로컬 FastAPI.
export default defineConfig(({ mode }) => {
  const target = process.env.API_URL || loadEnv(mode, process.cwd(), '').API_URL || 'http://localhost:8000'
  const proxy = { target, changeOrigin: true, secure: false }
  return {
    plugins: [react()],
    server: { proxy: { '/api': proxy, '/health': proxy } },
  }
})
