-- MuzBingo — несколько городов (запусти в Supabase → SQL Editor)
-- У каждой игры появляется город. Все уже созданные игры считаем астанинскими.
alter table public.events
  add column if not exists city text not null default 'Астана';

create index if not exists events_city_starts_idx on public.events (city, starts_at);
