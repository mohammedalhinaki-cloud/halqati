import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
const buildVersion = Date.now().toString()
export default defineConfig({
  base: '/halqati/',
  plugins: [react(), {
    name: 'cache-buster',
    transformIndexHtml(html) {
      return html.replace('content="v=20250912-2"', `content="v=${buildVersion}"`)
    },
    closeBundle() {
      try {
        const distPath = path.resolve('dist/index.html')
        if (fs.existsSync(distPath)) {
          let html = fs.readFileSync(distPath, 'utf-8')
          html = html.replace(/(src="\/halqati\/assets\/[^"]+\.js")/g, (m) => m.replace('.js"', `.js?v=${buildVersion}"`))
          html = html.replace(/(href="\/halqati\/assets\/[^"]+\.css")/g, (m) => m.replace('.css"', `.css?v=${buildVersion}"`))
          html = html.replace('</head>', `  <!-- Cache-Buster v=${buildVersion} -->\n  </head>`)
          fs.writeFileSync(distPath, html)
          console.log(`✓ Cache-Buster applied v=${buildVersion}`)
        }
      } catch (e) { console.warn('cache-buster failed', e) }
    }
  }],
  server: { 
    host: '0.0.0.0', 
    port: 5173,
    cors: true,
    hmr: { clientPort: 443 },
    // @ts-ignore - allow all hosts for E2B preview
    allowedHosts: true
  }
})
