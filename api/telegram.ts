// POST /api/telegram — вебхук Telegram. Реагирует на команды владельца.
// Проверяет X-Telegram-Bot-Api-Secret-Token и пускает только chat_id из TELEGRAM_CHAT_ID (список через запятую).
// Использует service_role-ключ Supabase, чтобы обходить RLS (полный доступ к events/signups).
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TZ = 'Asia/Almaty'; // весь Казахстан теперь UTC+5 — подходит и Астане, и Экибастузу
const DEFAULT_CITY = 'Астана';

// Приводим город к единому виду, чтобы «экибастуз» и «Экибастуз » на сайте были одной вкладкой
// «5000», «5 000», «5000 тг», «5000₸» → 5000. «нет», «0», «-» → null. Иначе undefined (не цена).
function parsePrice(raw: string): number | null | undefined {
  const t = (raw || '').trim().toLowerCase();
  if (!t) return undefined;
  if (['нет', '-', '0', 'бесплатно'].includes(t)) return null;
  const m = t.replace(/\s/g, '').match(/^(\d+)(тг|тенге|₸|kzt)?$/);
  return m ? Number(m[1]) : undefined;
}

function priceLabel(price: number | null | undefined): string {
  return typeof price === 'number' && price > 0 ? ` · ${price.toLocaleString('ru-RU')} ₸` : '';
}

function normCity(raw: string): string {
  const c = raw.trim().replace(/\s+/g, ' ');
  return c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : '';
}

export type AddGame = { startsAt: string; city: string; venue: string | null; price: number | null };

/**
 * Разбор аргументов /addgame: «YYYY-MM-DD HH:MM [Город |] Место [| Цена]».
 * Время — казахстанское (UTC+5). Несуществующие даты (31.02, 24:30) отклоняем:
 * JS молча превращает их в другой день, и игра ушла бы в календарь не тем числом.
 */
export function parseAddGame(args: string): AddGame | { error: string } {
  const m = args.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?:\s+(.+))?$/);
  if (!m) return { error: 'Формат: /addgame 2026-10-21 20:00 Экибастуз | Harat’s Pub | 5000' };
  const [, y, mo, d, hh, mm, rest] = m;
  const [Y, M, D, H, Min] = [y, mo, d, hh, mm].map(Number);
  const probe = new Date(Date.UTC(Y, M - 1, D, H, Min));
  if (H > 23 || Min > 59 || probe.getUTCFullYear() !== Y || probe.getUTCMonth() !== M - 1 || probe.getUTCDate() !== D) {
    return { error: `Такой даты или времени нет: ${y}-${mo}-${d} ${hh}:${mm}` };
  }
  // «Город | Место | Цена». Без разделителя — старый формат, город по умолчанию Астана.
  let city = DEFAULT_CITY;
  let venue: string | null = rest?.trim() || null;
  let price: number | null = null;
  if (rest && rest.includes('|')) {
    const parts = rest.split('|').map((x) => x.trim());
    city = normCity(parts[0]) || DEFAULT_CITY;
    // Последний кусок — цена, если он целиком число («5000», «5 000», «5000 тг»)
    if (parts.length >= 3) {
      const parsed = parsePrice(parts[parts.length - 1]);
      if (parsed !== undefined) {
        price = parsed;
        parts.pop();
      }
    }
    venue = parts.slice(1).join(' | ').trim() || null;
  }
  const startsAt = new Date(probe.getTime() - 5 * 3600_000).toISOString();
  return { startsAt, city, venue, price };
}

const HELP_TEXT = `Команды:
/games — список будущих игр
/addgame YYYY-MM-DD HH:MM Город | Место | Цена — добавить игру
   пример: /addgame 2026-10-21 20:00 Экибастуз | Harat's Pub | 5000
   цена — в тенге за человека, можно не указывать
   без «Город |» игра попадёт в Астану
/setprice <id> <цена> — поменять цену игры (0 или «нет» — убрать)
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

// Telegram не принимает сообщения длиннее 4096 символов — и молча не доставляет их.
// Перед игрой с толпой гостей /signups легко вылезает за предел, поэтому режем
// по строкам (запас до 4000), чтобы ни одна запись не порвалась пополам.
const TG_LIMIT = 4000;
export function splitForTelegram(text: string, limit = TG_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    const piece = line.length > limit ? line.slice(0, limit) : line;
    if (cur && cur.length + 1 + piece.length > limit) { parts.push(cur); cur = piece; }
    else cur = cur ? cur + '\n' + piece : piece;
  }
  if (cur) parts.push(cur);
  return parts;
}

async function send(token: string, chatId: string, text: string): Promise<void> {
  for (const part of splitForTelegram(text)) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: part }),
      });
    } catch {
      /* пусть; в воркфлоу владельца это не критично */
    }
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
    const g = parseAddGame(args);
    if ('error' in g) {
      await send(token, chatId, g.error);
      return;
    }
    const { startsAt, city, venue, price } = g;
    const { data, error } = await supabase
      .from('events')
      .insert({ starts_at: startsAt, venue, city, price })
      .select('id')
      .single();
    if (error || !data) {
      await send(token, chatId, 'Ошибка: ' + (error?.message || 'insert failed'));
      return;
    }
    await send(
      token,
      chatId,
      `Добавил игру #${data.id} — ${city}, ${fmt(startsAt)}${venue ? ' · ' + venue : ''}${priceLabel(price)}`
    );
    return;
  }

  if (cmd === '/setprice') {
    const m = args.match(/^(\d+)\s+(.+)$/);
    const price = m ? parsePrice(m[2]) : undefined;
    if (!m || price === undefined) {
      await send(token, chatId, 'Формат: /setprice 12 5000  (0 или «нет» — убрать цену)');
      return;
    }
    const { error } = await supabase.from('events').update({ price }).eq('id', Number(m[1]));
    if (error) {
      await send(token, chatId, 'Ошибка: ' + error.message);
      return;
    }
    await send(token, chatId, price ? `Цена игры #${m[1]}: ${price.toLocaleString('ru-RU')} ₸` : `Цену у игры #${m[1]} убрал.`);
    return;
  }

  if (cmd === '/games') {
    const { data, error } = await supabase
      .from('events')
      .select('id, starts_at, venue, city, price')
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
      (e) => `#${e.id} — ${e.city || DEFAULT_CITY}, ${fmt(e.starts_at)}${e.venue ? ' · ' + e.venue : ''}${priceLabel(e.price)}`
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
      .select('id, starts_at, venue, city, price, signups(id, name, phone, people_count)')
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
      city: string | null;
      price: number | null;
      signups: Array<{ id: number; name: string; phone: string; people_count: number }>;
    }>;
    if (events.length === 0) {
      await send(token, chatId, 'Будущих игр нет.');
      return;
    }
    const parts: string[] = [];
    for (const e of events) {
      const head = `Игра #${e.id} — ${e.city || DEFAULT_CITY}, ${fmt(e.starts_at)}${e.venue ? ' · ' + e.venue : ''}${priceLabel(e.price)}`;
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
  // Вайтлист админов: несколько chat_id через запятую. Первый — главный владелец,
  // ему же приходят сообщения о том, что боту пишет кто-то посторонний.
  const admins = String(process.env.TELEGRAM_CHAT_ID || '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  const ownerChatId = admins[0] || '';
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

  // Только новые сообщения. Отредактированное сообщение Telegram присылает заново,
  // и правка старого «/addgame» создавала вторую такую же игру на сайте.
  const msg = update?.message;
  const chatId = String(msg?.chat?.id || '');
  let text: string = typeof msg?.text === 'string' ? msg.text.trim() : '';

  if (!chatId) {
    res.status(200).json({ ok: true });
    return;
  }

  // Не из вайтлиста: команды не выполняем, но на /start говорим человеку его id
  // и сообщаем владельцу, кто пишет. Иначе узнать id нового ведущего нельзя —
  // Telegram не отдаёт id по @username.
  if (!admins.includes(chatId)) {
    if (/^\/start/.test(text)) {
      const u = msg?.from || {};
      const who = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'без имени';
      const handle = u.username ? '@' + u.username : 'без username';
      await send(token, chatId, `Бот только для команды MuzBingo. Твой id: ${chatId} — передай его владельцу.`);
      await send(
        token,
        ownerChatId,
        `Боту написал посторонний: ${who} (${handle}), id ${chatId}.
` +
        `Чтобы дать доступ — добавь ${chatId} через запятую в TELEGRAM_CHAT_ID в Vercel.`
      );
    }
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
