import QRCode from 'qrcode';

const cache = new Map<string, string>();

// Локальная генерация QR в виде data:image/png. Без сетевых запросов — не падает оффлайн.
export async function qrDataUrl(payload: string): Promise<string> {
  if (cache.has(payload)) return cache.get(payload)!;
  const url = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 8,           // 8 модулей × ~25 модулей = ~200px стороны (хватает для печати)
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
  cache.set(payload, url);
  return url;
}

// Заполняет шаблон вида "MUZ-{id}" / "https://x.com/c/{id}"
export function buildQrPayload(template: string | undefined, cardId: string): string {
  if (!template) return `MUZ-${cardId}`;
  return template.replace('{id}', cardId);
}
