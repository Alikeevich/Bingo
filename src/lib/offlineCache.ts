/**
 * Регистрация Service Worker и работа с офлайн-кэшем треков.
 *
 * Кэш живёт в Service Worker (public/sw.js) — только так тег <audio> реально
 * получает файлы с диска, а не из сети. Без SW кнопка «Офлайн Кэш» лишь
 * складывала данные в хранилище, откуда их никто не читал.
 */

export function registerOfflineCache() {
  if (!('serviceWorker' in navigator)) return;
  // Регистрируем после загрузки страницы, чтобы не отнимать ресурсы у первого рендера
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('[offline] не удалось зарегистрировать SW:', e);
    });
  });
}

export function isOfflineCacheReady(): boolean {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
}

/**
 * Просит Service Worker скачать треки в кэш. Возвращает промис, который
 * завершается, когда обработаны все ссылки.
 */
export function cacheTracks(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw || urls.length === 0) { resolve(); return; }

    const onMessage = (e: MessageEvent) => {
      const { type, done, total } = e.data || {};
      if (type !== 'CACHE_PROGRESS') return;
      onProgress?.(done, total);
      if (done >= total) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    sw.postMessage({ type: 'CACHE_TRACKS', urls });

    // Страховка: не держим интерфейс в ожидании дольше 10 минут
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve();
    }, 10 * 60 * 1000);
  });
}
