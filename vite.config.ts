import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

// Прокси-плагин для аудио — добавляет CORS-заголовки, нужен для Cache API
const audioProxyPlugin: Plugin = {
  name: 'audio-proxy',
  configureServer(server) {
    server.middlewares.use(
      '/api/audio',
      async (req: IncomingMessage, res: ServerResponse) => {
        const fullUrl = `http://localhost${req.url}`
        const targetUrl = new URL(fullUrl).searchParams.get('url')

        if (!targetUrl) {
          res.statusCode = 400
          res.end('Missing ?url= param')
          return
        }

        try {
          const upstream = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Range: (req.headers['range'] as string) || '',
            },
          })

          const ct = upstream.headers.get('content-type') || 'audio/mpeg'
          const cl = upstream.headers.get('content-length') || ''

          res.setHeader('Content-Type', ct)
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Cache-Control', 'public, max-age=86400')
          if (cl) res.setHeader('Content-Length', cl)
          res.setHeader('Accept-Ranges', 'bytes')

          if (upstream.status === 206) {
            res.statusCode = 206
            const range = upstream.headers.get('content-range')
            if (range) res.setHeader('Content-Range', range)
          } else {
            res.statusCode = upstream.ok ? 200 : upstream.status
          }

          const buf = await upstream.arrayBuffer()
          res.end(Buffer.from(buf))
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error('[audio-proxy] error:', msg)
          res.statusCode = 502
          res.end('Proxy error: ' + msg)
        }
      }
    )
  },
}

export default defineConfig({
  plugins: [react(), audioProxyPlugin],
  server: {
    proxy: {
      '/api/deezer': {
        target: 'https://api.deezer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deezer/, ''),
      },
    },
  },
})
