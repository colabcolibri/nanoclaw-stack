import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const vitePort = Number(env.VITE_DEV_PORT || process.env.VITE_DEV_PORT) || 5080
  const apiPort = Number(env.PORT || process.env.PORT) || 5081
  const apiOrigin = `http://localhost:${apiPort}`

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, '../src/public'),
      emptyOutDir: true,
    },
    server: {
      port: vitePort,
      strictPort: true,
      proxy: {
        '/api': apiOrigin,
        '/auth': apiOrigin,
      },
    },
  }
})
