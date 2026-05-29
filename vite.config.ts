import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { formatBookingMessage, BookingPayload } from './src/landing/bookingMessage'

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

export default defineConfig(({ mode }) => {
  // Грузим ВСЕ env (включая TELEGRAM_*, без префикса VITE_) для dev-обработчика заявок
  const env = loadEnv(mode, process.cwd(), '')

  // Локальный аналог serverless-функции api/booking.ts — чтобы форма брони
  // работала и в `npm run dev`, не только в проде на Vercel.
  const bookingDevPlugin: Plugin = {
    name: 'booking-api-dev',
    configureServer(server) {
      server.middlewares.use(
        '/api/booking',
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          let body = ''
          for await (const chunk of req) body += chunk

          const json = (status: number, obj: unknown) => {
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }

          try {
            const payload = JSON.parse(body || '{}') as BookingPayload
            if (!payload?.name?.trim() || !payload?.phone?.trim()) {
              return json(400, { error: 'name and phone are required' })
            }
            const token = env.TELEGRAM_BOT_TOKEN
            const chatId = env.TELEGRAM_CHAT_ID
            if (!token || !chatId) {
              return json(500, { error: 'Telegram bot is not configured' })
            }
            const tg = await fetch(
              `https://api.telegram.org/bot${token}/sendMessage`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: formatBookingMessage(payload),
                }),
              }
            )
            if (!tg.ok) {
              return json(502, { error: 'Failed to deliver to Telegram' })
            }
            return json(200, { ok: true })
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            return json(500, { error: msg })
          }
        }
      )
    },
  }

  return {
    plugins: [react(), audioProxyPlugin, bookingDevPlugin],
    // Полифиллы для @react-pdf/renderer (использует Node globals)
    define: {
      global: 'globalThis',
    },
    server: {
      proxy: {
        '/api/deezer': {
          target: 'https://api.deezer.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/deezer/, ''),
        },
      },
    },
  }
})
