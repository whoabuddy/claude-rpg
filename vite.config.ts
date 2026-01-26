import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import os from 'os'

const CLIENT_PORT = parseInt(process.env.CLAUDE_RPG_CLIENT_PORT || '4010')
const SERVER_PORT = parseInt(process.env.CLAUDE_RPG_PORT || '4011')

// Load HTTPS certs if available (skip entirely if no certs — tunnel provides TLS)
const certsDir = path.join(os.homedir(), '.claude-rpg', 'certs')
const hasCerts = fs.existsSync(path.join(certsDir, 'key.pem')) && fs.existsSync(path.join(certsDir, 'cert.pem'))
const httpsConfig = hasCerts
  ? {
      key: fs.readFileSync(path.join(certsDir, 'key.pem')),
      cert: fs.readFileSync(path.join(certsDir, 'cert.pem')),
    }
  : false

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
    https: httpsConfig, // Only enable when certs exist; tunnel provides TLS otherwise
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
      '/event': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
      '/health': {
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
