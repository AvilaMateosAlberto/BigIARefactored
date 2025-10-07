import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // permite acceso desde cualquier host
    port: 5173,
    cors: true,   // permite peticiones desde cualquier origen
    strictPort: true // opcional: no cambia de puerto si está ocupado
  }
})
