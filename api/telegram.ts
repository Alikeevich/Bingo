// POST /api/telegram — вебхук Telegram. Реагирует на команды владельца.
// Проверяет X-Telegram-Bot-Api-Secret-Token и сравнивает chat_id с TELEGRAM_CHAT_ID.
// Использует service_role-ключ Supabase, чтобы обходить RLS (полный доступ к events/signups).
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TZ = 'Asia/Almaty'; // UTC+5, без перехода на летнее время

const HELP_TEXT = `Команды:
/games — список будущих игр
/addgame YYYY-MM-DD HH:MM Место — добавить игру (время Астаны)
/delgame <id> — удалить игру (вместе с её записями)
/signups — все будущие игры и записи под ними
/delsignup <id> — удалить запись (если человек отказался)`;

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function send(token: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    /* пусть; в воркфлоу владельца это не критично */
  }
}

async function runCommand(
  rawText: string,
  supabase: SupabaseClient,
  token: string,
  chatId: string
): Promise<void> {
  const firstSpace = rawText.indexOf(' ');
  const head = firstSpace === -1 ? rawText : rawText.slice(0, firstSpace);
  const cmd = head.split('@')[0].toLowerCase(); // снимаем @BotName на случай группового чата
  const args = firstSpace === -1 ? '' : rawText.slice(firstSpace + 1).trim();

  if (cmd === '/help' || cmd === '/start') {
    await send(token, chatId, HELP_TEXT);
    return;
  }

  if (cmd === '/addgame') {
    // Формат: YYYY-MM-DD HH:MM Место...
    const m = args.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(?:\s+(.+))?$/);
    if (!m) {
      await send(
        token,
        chatId,
        'Формат: /addgame 2026-06-15 20:00 Harat’s Pub'
      );
      return;
    }
    const [, date, time, venue] = m;
    const [hh, mm] = time.split(':');
    const iso = `${date}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00+05:00`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      await send(token, chatId, 'Не понимаю дату/время.');
      return;
    }
    const { data, error } = await supabase
      .from('events')
      .insert({ starts_at: d.toISOString(), venue: venue?.trim() || null })
      .select('id')
      .single();
    if (error || !data) {
      await send(token, chatId, 'Ошибка: ' + (error?.message || 'insert failed'));
      return;
    }
    await send(
      token,
      chatId,
      `Добавил игру #${data.id} — ${fmt(d.toISOString())}${venue ? ' · ' + venue.trim() : ''}`
    );
    return;
  }

  if (cmd === '/games') {
    const { data, error } = await supabase
      .from('events')
      .select('id, starts_at, venue')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true });
    if (error) {
      await send(token, chatId, 'Ошибка: ' + error.message);
      return;
    }
    if (!data || data.length === 0) {
      await send(token, chatId, 'Будущих игр нет. Добавь через /addgame.');
      return;
    }
    const lines = data.map(
      (e) => `#${e.id} — ${fmt(e.starts_at)}${e.venue ? ' · ' + e.venue : ''}`
    );
    await send(token, chatId, 'Будущие игры:\n' + lines.join('\n'));
    return;
  }

  if (cmd === '/delgame') {
    const id = Number(args);
    if (!Number.isFinite(id) || id <= 0) {
      await send(token, chatId, 'Укажи id: /delgame 12');
      return;
    }
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) {
      await send(token, chatId, 'Ошибка: ' + error.message);
      return;
    }
    await send(token, chatId, `Удалил игру #${id} и её записи.`);
    return;
  }

  if (cmd === '/signups') {
    const { data, error } = await supabase
      .from('events')
      .select('id, starts_at, venue, signups(id, name, phone, people_count)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true });
    if (error) {
      await send(token, chatId, 'Ошибка: ' + error.message);
      return;
    }
    const events = (data ?? []) as Array<{
      id: number;
      starts_at: string;
      venue: string | null;
      signups: Array<{ id: number; name: string; phone: string; people_count: number }>;
    }>;
    if (events.length === 0) {
      await send(token, chatId, 'Будущих игр нет.');
      return;
    }
    const parts: string[] = [];
    for (const e of events) {
      const head = `Игра #${e.id} — ${fmt(e.starts_at)}${e.venue ? ' · ' + e.venue : ''}`;
      parts.push(head);
      const sUps = e.signups ?? [];
      if (sUps.length === 0) {
        parts.push('  записей нет');
      } else {
        const total = sUps.reduce((s, x) => s + (x.people_count || 0), 0);
        parts.push(`  всего: ${sUps.length} запис(ей), ${total} чел.`);
        for (const s of sUps) {
          parts.push(`  [#${s.id}] ${s.name} · ${s.phone} · ${s.people_count} чел.`);
        }
      }
      parts.push('');
    }
    await send(token, chatId, parts.join('\n').trim());
    return;
  }

  if (cmd === '/delsignup') {
    const id = Number(args);
    if (!Number.isFinite(id) || id <= 0) {
      await send(token, chatId, 'Укажи id: /delsignup 34');
      return;
    }
    const { error } = await supabase.from('signups').delete().eq('id', id);
    if (error) {
      await send(token, chatId, 'Ошибка: ' + error.message);
      return;
    }
    await send(token, chatId, `Удалил запись #${id}.`);
    return;
  }

  await send(token, chatId, 'Неизвестная команда. Напиши /help.');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerChatId = String(process.env.TELEGRAM_CHAT_ID || '');
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !token || !ownerChatId || !supaUrl || !serviceKey) {
    res.status(500).json({ error: 'webhook not configured' });
    return;
  }

  // Проверка, что POST пришёл именно от Telegram
  const incoming = req.headers['x-telegram-bot-api-secret-token'];
  if (incoming !== secret) {
    res.status(401).end();
    return;
  }

  let update: any = {};
  try {
    update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    res.status(200).json({ ok: true });
    return;
  }

  const msg = update?.message ?? update?.edited_message;
  const chatId = String(msg?.chat?.id || '');
  let text: string = typeof msg?.text === 'string' ? msg.text.trim() : '';

  // Чужие чаты игнорируем молча
  if (!chatId || chatId !== ownerChatId) {
    res.status(200).json({ ok: true });
    return;
  }

  // Чиним типичную опечатку "./command" → "/command"
  if (text.startsWith('./')) text = text.slice(1);

  // Владельцу всегда отвечаем — если это не команда, даём подсказку, а не тишину
  if (!text.startsWith('/')) {
    await send(token, chatId, 'Не понял. Напиши /help, чтобы увидеть команды.');
    res.status(200).json({ ok: true });
    return;
  }

  const supabase = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await runCommand(text, supabase, token, chatId);
  } catch (e: any) {
    await send(token, chatId, 'Сбой: ' + (e?.message || String(e)));
  }

  res.status(200).json({ ok: true });
}
