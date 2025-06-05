/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/playlist-tidy/',
  server: {
    port: 5173
  },
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      external: ['jsonwebtoken', 'fs', 'crypto', 'buffer']
    }
  },
  optimizeDeps: {
    exclude: ['jsonwebtoken']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
})
