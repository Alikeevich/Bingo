-- ============================================================================
-- MuzBingo — система записи на игры (запусти в Supabase → SQL Editor)
-- ============================================================================
-- events  — запланированные игры (дата + место), добавляются через Telegram-бота
-- signups — записи людей на конкретную игру (имя, телефон, кол-во человек)
--
-- ПУБЛИКА может:
--   - читать предстоящие игры (для календаря на лендинге)
--   - вставлять свою запись на игру (форма)
-- ВСЁ ОСТАЛЬНОЕ (добавить/удалить игру, прочитать список записей, удалить запись)
-- делает только бот через service_role — он обходит RLS.
-- ----------------------------------------------------------------------------

create table if not exists public.events (
  id         bigserial primary key,
  starts_at  timestamptz not null,
  venue      text,
  created_at timestamptz not null default now()
);

create table if not exists public.signups (
  id           bigserial primary key,
  event_id     bigint not null references public.events(id) on delete cascade,
  name         text   not null,
  phone        text   not null,
  people_count int    not null default 1,
  created_at   timestamptz not null default now()
);

create index if not exists signups_event_id_idx on public.signups(event_id);
create index if not exists events_starts_at_idx on public.events(starts_at);

alter table public.events  enable row level security;
alter table public.signups enable row level security;

-- Публично читаемые ПРЕДСТОЯЩИЕ игры (прошедшие не отдаём)
drop policy if exists "public read upcoming events" on public.events;
create policy "public read upcoming events" on public.events
  for select using (starts_at >= now());

-- Любой может оставить запись (форма брони)
drop policy if exists "public insert signup" on public.signups;
create policy "public insert signup" on public.signups
  for insert with check (true);

-- НАМЕРЕННО нет: public select/update/delete для signups,
-- и нет public insert/update/delete для events. Это делает только бот.

-- ============================================================================
-- КАК ПОДКЛЮЧИТЬ БОТА (после деплоя)
-- ----------------------------------------------------------------------------
-- 1. В Supabase → Settings → API скопируй ключ `service_role` (SECRET!).
--    Добавь его в Vercel → Settings → Environment Variables как
--    SUPABASE_SERVICE_ROLE_KEY (Production). Только сервер! Не VITE_*.
--
-- 2. Сгенерируй случайный секрет (любая длинная строка) и положи в Vercel как
--    TELEGRAM_WEBHOOK_SECRET — мы будем проверять, что запросы приходят именно
--    от Telegram, а не от посторонних.
--
-- 3. После деплоя один раз скажи Telegram, куда слать апдейты:
--    curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://muzbingo.vercel.app/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
--
-- Команды бота (доступны только владельцу — chat_id из TELEGRAM_CHAT_ID):
--    /help                              — список команд
--    /addgame YYYY-MM-DD HH:MM Место    — добавить игру (часовой пояс Astana, UTC+5)
--    /games                             — список будущих игр с id
--    /delgame <id>                      — удалить игру (и все её записи)
--    /signups                           — все будущие игры + записи под ними
--    /delsignup <id>                    — удалить одну запись (если человек отказался)
-- ============================================================================
