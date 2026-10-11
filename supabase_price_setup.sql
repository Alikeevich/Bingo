-- MuzBingo — стоимость игры (запусти в Supabase → SQL Editor)
-- Цена в тенге за человека. NULL — цена не показывается.
alter table public.events
  add column if not exists price integer check (price is null or price >= 0);
