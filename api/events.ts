// GET /api/events — список ПРЕДСТОЯЩИХ игр для календаря на лендинге.
// Использует anon-ключ Supabase — RLS-политика public_read_upcoming_events
// сама фильтрует прошедшие игры.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    res.status(500).json({ error: 'Supabase is not configured' });
    return;
  }

  const supabase = createClient(url, anon);
  let { data, error } = await supabase
    .from('events')
    .select('id, starts_at, venue, city, price')
    .order('starts_at', { ascending: true });
  // Колонки city ещё нет (SQL не применён) — отдаём без неё, сайт не должен падать
  if (error && /city|price/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('events')
      .select('id, starts_at, venue')
      .order('starts_at', { ascending: true }) as any);
  }

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Лёгкое кеширование на edge: до 30с свежее, до 60с stale-while-revalidate
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ events: data ?? [] });
}
