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

    // Запросы с Range (перемотка аудио) не кэшируем — отдаём сети, иначе
    // браузер получит кусок вместо полного файла и звук поедет.
    if (req.headers.has('range')) {
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
