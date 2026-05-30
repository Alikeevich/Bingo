// POST /api/signup — записать человека на конкретную игру.
// Проверяет, что игра ещё не прошла, вставляет signup и уведомляет владельца в Telegram.
// Заменяет старую /api/booking.
import { createClient } from '@supabase/supabase-js';

type Payload = {
  event_id?: number | string;
  name?: string;
  phone?: string;
  people_count?: number | string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaAnon = process.env.VITE_SUPABASE_ANON_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!supaUrl || !supaAnon) {
    res.status(500).json({ error: 'Supabase is not configured' });
    return;
  }

  let p: Payload = {};
  try {
    p = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const eventId = Number(p.event_id);
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const phone = typeof p.phone === 'string' ? p.phone.trim() : '';
  const people = Math.max(1, Math.min(50, Number(p.people_count) || 1));

  if (!Number.isFinite(eventId) || eventId <= 0 || !name || !phone) {
    res.status(400).json({ error: 'event_id, name and phone are required' });
    return;
  }
  if (phone.replace(/\D/g, '').length < 11) {
    res.status(400).json({ error: 'phone must contain at least 11 digits' });
    return;
  }

  const supabase = createClient(supaUrl, supaAnon);

  // Проверяем, что игра существует и ещё не прошла
  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('id, starts_at, venue')
    .eq('id', eventId)
    .maybeSingle();
  if (evErr || !ev) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (new Date(ev.starts_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Event already started' });
    return;
  }

  const { data: signup, error: signupErr } = await supabase
    .from('signups')
    .insert({ event_id: eventId, name, phone, people_count: people })
    .select('id')
    .single();
  if (signupErr || !signup) {
    res.status(500).json({ error: signupErr?.message || 'Insert failed' });
    return;
  }

  // Уведомляем владельца в Telegram (не критично, если упадёт)
  if (botToken && chatId) {
    const text = [
      'Новая запись на игру',
      '',
      `Имя: ${name}`,
      `Телефон: ${phone}`,
      `Гостей: ${people}`,
      `Игра: ${fmtDate(ev.starts_at)}${ev.venue ? ' · ' + ev.venue : ''}`,
      '',
      `Удалить запись: /delsignup ${signup.id}`,
    ].join('\n');
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch {
      /* пусть запись уже создана — уведомление не критично */
    }
  }

  res.status(200).json({ ok: true, signup_id: signup.id });
}
