import { formatBookingMessage, BookingPayload } from '../src/landing/bookingMessage';

// Vercel serverless function. Принимает заявку с лендинга и шлёт её владельцу
// через Telegram-бота. Токен и chat_id берутся из env (не попадают на клиент).
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

  const payload = req.body as BookingPayload;
  if (!payload?.name?.trim() || !payload?.phone?.trim()) {
    res.status(400).json({ error: 'name and phone are required' });
    return;
  }

  const text = formatBookingMessage(payload);
  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!tg.ok) {
    const detail = await tg.text();
    res.status(502).json({ error: 'Failed to deliver to Telegram', detail });
    return;
  }

  res.status(200).json({ ok: true });
}
