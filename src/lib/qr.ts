import QRCode from 'qrcode';

const cache = new Map<string, string>();

// Локальная генерация QR в виде data:image/png. Без сетевых запросов — не падает оффлайн.
export async function qrDataUrl(payload: string): Promise<string> {
  if (cache.has(payload)) return cache.get(payload)!;
  const raw = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 8,           // 8 модулей × ~25 модулей = ~200px стороны (хватает для печати)
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
  // Библиотека всегда отдаёт PNG с альфа-каналом. Из-за него @react-pdf кладёт в PDF
  // маску прозрачности (SMask), а принтеры из-за неё печатают лист тускло, «со слоем».
  // Перерисовываем на непрозрачном холсте — QR тот же, прозрачности нет.
  const url = await stripAlpha(raw);
  cache.set(payload, url);
  return url;
}


// Перерисовывает data:image/png на непрозрачном холсте (белый фон, без альфы).
async function stripAlpha(dataUrl: string): Promise<string> {
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
      img.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    // alpha: false — холст без прозрачности, экспорт получается плотным
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return dataUrl;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return dataUrl; // не получилось — печатаем как есть, лучше чем без QR
  }
}

// Заполняет шаблон вида "MUZ-{id}" / "https://x.com/c/{id}"
export function buildQrPayload(template: string | undefined, cardId: string): string {
  if (!template) return `MUZ-${cardId}`;
  return template.replace('{id}', cardId);
}
