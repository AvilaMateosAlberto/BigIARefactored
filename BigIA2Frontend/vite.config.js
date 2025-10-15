import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // <- para acceder por IP (10.14.1.223)
    port: 5173,
  },
})
