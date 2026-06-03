import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { createClient } from '@supabase/supabase-js'

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

function jsonRes(res: ServerResponse, status: number, obj: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}

export default defineConfig(({ mode }) => {
  // Грузим ВСЕ env (включая TELEGRAM_* / VITE_SUPABASE_*) для dev-обработчиков
  const env = loadEnv(mode, process.cwd(), '')

  // GET /api/events — локальный аналог serverless-функции api/events.ts
  const eventsDevPlugin: Plugin = {
    name: 'events-api-dev',
    configureServer(server) {
      server.middlewares.use(
        '/api/events',
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'GET') return jsonRes(res, 405, { error: 'Method not allowed' })
          const url = env.VITE_SUPABASE_URL
          const anon = env.VITE_SUPABASE_ANON_KEY
          if (!url || !anon) return jsonRes(res, 500, { error: 'Supabase is not configured' })
          try {
            const supabase = createClient(url, anon)
            const { data, error } = await supabase
              .from('events')
              .select('id, starts_at, venue')
              .order('starts_at', { ascending: true })
            if (error) return jsonRes(res, 500, { error: error.message })
            jsonRes(res, 200, { events: data ?? [] })
          } catch (e: unknown) {
            jsonRes(res, 500, { error: e instanceof Error ? e.message : String(e) })
          }
        }
      )
    },
  }

  // POST /api/signup — локальный аналог serverless-функции api/signup.ts
  const signupDevPlugin: Plugin = {
    name: 'signup-api-dev',
    configureServer(server) {
      server.middlewares.use(
        '/api/signup',
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' })
          const url = env.VITE_SUPABASE_URL
          const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
          if (!url || !serviceKey) return jsonRes(res, 500, { error: 'Supabase is not configured' })
          try {
            const body = await readBody(req)
            const p = JSON.parse(body || '{}') as {
              event_id?: number; name?: string; phone?: string; people_count?: number;
            }
            const eventId = Number(p.event_id)
            const name = typeof p.name === 'string' ? p.name.trim() : ''
            const phone = typeof p.phone === 'string' ? p.phone.trim() : ''
            const people = Math.max(1, Math.min(50, Number(p.people_count) || 1))
            if (!Number.isFinite(eventId) || eventId <= 0 || !name || !phone) {
              return jsonRes(res, 400, { error: 'event_id, name and phone are required' })
            }
            if (phone.replace(/\D/g, '').length < 11) {
              return jsonRes(res, 400, { error: 'phone must contain at least 11 digits' })
            }
            const supabase = createClient(url, serviceKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            })
            const { data: ev } = await supabase
              .from('events').select('id, starts_at, venue').eq('id', eventId).maybeSingle()
            if (!ev) return jsonRes(res, 404, { error: 'Event not found' })
            if (new Date(ev.starts_at as string).getTime() < Date.now()) {
              return jsonRes(res, 400, { error: 'Event already started' })
            }
            const { data: signup, error: insErr } = await supabase
              .from('signups')
              .insert({ event_id: eventId, name, phone, people_count: people })
              .select('id')
              .single()
            if (insErr || !signup) return jsonRes(res, 500, { error: insErr?.message || 'Insert failed' })

            const token = env.TELEGRAM_BOT_TOKEN
            const chatId = env.TELEGRAM_CHAT_ID
            if (token && chatId) {
              const dateStr = new Date(ev.starts_at as string).toLocaleString('ru-RU', {
                timeZone: 'Asia/Almaty',
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
              const text = [
                'Новая запись на игру (DEV)', '',
                `Имя: ${name}`, `Телефон: ${phone}`, `Гостей: ${people}`,
                `Игра: ${dateStr}${ev.venue ? ' · ' + ev.venue : ''}`, '',
                `Удалить запись: /delsignup ${signup.id}`,
              ].join('\n')
              try {
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: chatId, text }),
                })
              } catch { /* notification non-critical */ }
            }

            jsonRes(res, 200, { ok: true, signup_id: signup.id })
          } catch (e: unknown) {
            jsonRes(res, 500, { error: e instanceof Error ? e.message : String(e) })
          }
        }
      )
    },
  }

  return {
    plugins: [react(), audioProxyPlugin, eventsDevPlugin, signupDevPlugin],
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
