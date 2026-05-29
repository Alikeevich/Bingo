// Vercel serverless function. Принимает заявку с лендинга и шлёт её владельцу
// через Telegram-бота. Токен и chat_id берутся из env (не попадают на клиент).
//
// ВАЖНО: функция самодостаточна — БЕЗ импортов из src/. При "type": "module"
// и сборке Vercel импорт из ../src ломал загрузку (FUNCTION_INVOCATION_FAILED).

type BookingPayload = {
  mode?: 'game' | 'franchise';
  name?: string;
  phone?: string;
  date?: string;
  people?: string;
  occasion?: string;
  city?: string;
  comment?: string;
};

function formatBookingMessage(p: BookingPayload): string {
  if (p.mode === 'franchise') {
    return [
      'Новая заявка на ФРАНШИЗУ MuzBingo',
      '',
      `Имя: ${p.name}`,
      `Телефон: ${p.phone}`,
      p.city && `Город: ${p.city}`,
      p.comment && `О себе: ${p.comment}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    'Новая заявка на игру MuzBingo',
    '',
    `Имя: ${p.name}`,
    `Телефон: ${p.phone}`,
    p.date && `Дата: ${p.date}`,
    p.people && `Гостей: ${p.people}`,
    p.occasion && `Повод: ${p.occasion}`,
    p.comment && `Комментарий: ${p.comment}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    res.status(500).json({ error: 'Telegram bot is not configured' });
    return;
  }

  // req.body может прийти строкой или объектом — нормализуем.
  let payload: BookingPayload = {};
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  if (!payload.name?.trim() || !payload.phone?.trim()) {
    res.status(400).json({ error: 'name and phone are required' });
    return;
  }

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: formatBookingMessage(payload) }),
    });
    if (!tg.ok) {
      const detail = await tg.text();
      res.status(502).json({ error: 'Failed to deliver to Telegram', detail });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Send failed', detail: String(e?.message || e) });
  }
}
