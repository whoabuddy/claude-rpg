import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const CLIENT_PORT = parseInt(process.env.CLAUDE_RPG_CLIENT_PORT || '4010')
const SERVER_PORT = parseInt(process.env.CLAUDE_RPG_PORT || '4011')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: CLIENT_PORT,
    host: true,  // Expose on LAN
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${SERVER_PORT}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
  define: {
    __SERVER_PORT__: SERVER_PORT,
  },
})
