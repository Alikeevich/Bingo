-- ============================================================================
-- MuzBingo — настройка авторизации франчайзи (запусти в Supabase → SQL Editor)
-- ============================================================================
-- Создаёт таблицу профилей, привязанную к auth.users, с флагом approved.
-- Логика: регистрация создаёт профиль с approved = false. Доступ к инструменту
-- (/app) открывается, когда владелец вручную ставит approved = true.
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  city       text,
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Пользователь может читать только свой профиль (чтобы фронт узнал approved).
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- НАМЕРЕННО нет политик insert/update для пользователей:
--   insert делает триггер ниже (security definer),
--   approved меняет только владелец из дашборда (или service role).

-- ----------------------------------------------------------------------------
-- Триггер: при регистрации создаём профиль и переносим данные из формы
-- (full_name / phone / city приходят в user_metadata через signUp options.data).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, city)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'city'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- КАК ОДОБРИТЬ ФРАНЧАЙЗИ (после регистрации):
--   update public.profiles set approved = true where email = 'partner@example.com';
-- Посмотреть заявки:
--   select email, full_name, phone, city, approved, created_at
--   from public.profiles order by created_at desc;
-- ============================================================================
