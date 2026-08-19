-- AutoSyndicate: реальная таблица игроков
-- Выполнить один раз в Supabase SQL Editor.
create table if not exists public.player_profiles (
  id text primary key,
  name text not null default 'Гонщик',
  photo_url text,
  level integer not null default 1,
  balance bigint not null default 0,
  xp integer not null default 0,
  races integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  total_earned bigint not null default 0,
  owned_cars integer[] not null default '{}',
  active_car_id integer not null default 1,
  last_seen timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

drop policy if exists "player_profiles_select" on public.player_profiles;
create policy "player_profiles_select"
on public.player_profiles for select
to anon, authenticated
using (true);

drop policy if exists "player_profiles_insert" on public.player_profiles;
create policy "player_profiles_insert"
on public.player_profiles for insert
to anon, authenticated
with check (true);

drop policy if exists "player_profiles_update" on public.player_profiles;
create policy "player_profiles_update"
on public.player_profiles for update
to anon, authenticated
using (true)
with check (true);

create index if not exists player_profiles_rank_idx
on public.player_profiles (level desc, total_earned desc);

create index if not exists player_profiles_last_seen_idx
on public.player_profiles (last_seen desc);
