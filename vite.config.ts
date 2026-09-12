import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/halqati/',
  plugins: [react()],
  server: { 
    host: '0.0.0.0', 
    port: 5173,
    cors: true,
    hmr: { clientPort: 443 },
    // @ts-ignore - allow all hosts for E2B preview
    allowedHosts: true
  }
})
