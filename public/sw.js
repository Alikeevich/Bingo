/**
 * Service Worker для офлайн-воспроизведения треков.
 *
 * Зачем: раньше кнопка «Офлайн Кэш» складывала файлы через Cache API, но их никто
 * не читал — тег <audio> ходит в сеть напрямую, а Cache API сам по себе запросы
 * не перехватывает. Из-за этого офлайна фактически не было, и на слабом интернете
 * в заведении каждый трек качался заново.
 *
 * Стратегия для аудио: сначала кэш, при промахе — сеть, и ответ кладём в кэш.
 */
const AUDIO_CACHE = 'muzbingo-audio-v1';

// Хосты, откуда приходит музыка и обложки
const AUDIO_HOSTS = [
  'r2.dev',                    // Cloudflare R2 — свои полные MP3
  'cdnt-preview.dzcdn.net',    // превью Deezer
  'cdns-preview',              // альтернативные CDN Deezer
  'supabase.co',               // Storage со старыми своими файлами
  'audio-ssl.itunes.apple.com',
  'mzstatic.com',              // обложки Apple
];

const isAudioRequest = (url) => {
  const u = url.toLowerCase();
  if (!AUDIO_HOSTS.some((h) => u.includes(h))) return false;
  return /\.(mp3|m4a|aac|wav|ogg|jpg|jpeg|png)(\?|$)/.test(u) || u.includes('/tracks/') || u.includes('preview');
};

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== AUDIO_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!isAudioRequest(req.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(AUDIO_CACHE);

    // ── Запросы с Range ──────────────────────────────────────────────────
    // Safari (и все браузеры на маке/айфоне) НИКОГДА не просит аудио целиком —
    // тег <audio> сразу шлёт «Range: bytes=0-». Раньше такие запросы уходили
    // мимо кэша прямо в сеть, поэтому офлайн-кэш работал в Chrome на винде и
    // не работал на маке вообще.
    // Теперь берём из кэша ЦЕЛЫЙ файл и сами нарезаем нужный кусок (206).
    if (req.headers.has('range')) {
      const m = /bytes=(\d*)-(\d*)/i.exec(req.headers.get('range') || '');
      // полный файл лежит в кэше под чистым URL (его кладёт «Офлайн Кэш»)
      let full = await cache.match(req.url, { ignoreVary: true });
      if (!full) {
        // качаем целиком (без Range) — заодно попадёт в кэш для следующего раза
        try {
          const res = await fetch(req.url, { mode: 'cors' });
          if (res && res.ok) { cache.put(req.url, res.clone()).catch(() => {}); full = res; }
        } catch (e) { /* сети нет — ниже отдадим что есть */ }
      }

      if (full && full.status === 200 && full.type !== 'opaque') {
        try {
          const buf = await full.clone().arrayBuffer();
          const size = buf.byteLength;
          if (size > 0) {
            const start = m && m[1] ? parseInt(m[1], 10) : 0;
            const end = Math.min(m && m[2] ? parseInt(m[2], 10) : size - 1, size - 1);
            if (start <= end) {
              return new Response(buf.slice(start, end + 1), {
                status: 206,
                statusText: 'Partial Content',
                headers: {
                  'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg',
                  'Content-Range': `bytes ${start}-${end}/${size}`,
                  'Content-Length': String(end - start + 1),
                  'Accept-Ranges': 'bytes',
                },
              });
            }
          }
        } catch (e) { /* не смогли нарезать — уходим в сеть */ }
      }

      // Непрозрачный (no-cors) ответ нарезать нельзя — отдаём как есть:
      // перемотка будет хуже, но офлайн работает.
      if (full && full.type === 'opaque') return full;

      try { return await fetch(req); } catch (e) {
        const cached = await cache.match(req, { ignoreVary: true });
        if (cached) return cached;
        throw e;
      }
    }

    const cached = await cache.match(req, { ignoreVary: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Кэшируем только удачные ответы; opaque (no-cors) тоже кладём — лучше, чем ничего
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (e) {
      const fallback = await cache.match(req, { ignoreVary: true });
      if (fallback) return fallback;
      throw e;
    }
  })());
});

// Приложение просит заранее скачать треки в кэш
self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {};
  if (type !== 'CACHE_TRACKS' || !Array.isArray(urls)) return;

  event.waitUntil((async () => {
    const cache = await caches.open(AUDIO_CACHE);
    let done = 0;
    for (const url of urls) {
      try {
        const hit = await cache.match(url, { ignoreVary: true });
        if (!hit) {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res.clone());
        }
      } catch { /* пропускаем недоступный трек */ }
      done++;
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.postMessage({ type: 'CACHE_PROGRESS', done, total: urls.length }));
    }
  })());
});
