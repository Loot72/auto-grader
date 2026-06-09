import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/auto-grader/', // ⭐️ 선생님의 깃허브 저장소 이름을 적어줍니다.
})