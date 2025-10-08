import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// cambia si tu backend corre en otra IP/puerto
const BACKEND = process.env.VITE_BACKEND || 'http://10.14.1.223:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // <- para acceder por IP (10.14.1.223)
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND, // http://10.14.1.223:3001
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
