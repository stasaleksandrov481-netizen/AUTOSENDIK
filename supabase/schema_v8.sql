-- AutoSyndicate: Carbon District — Supabase schema v8
-- Run in Supabase SQL Editor.
-- IMPORTANT: Dashboard -> Authentication -> Providers -> Anonymous Sign-Ins must be enabled.
-- The browser uses only a publishable key. Never place service_role in the client.

begin;

-- ==================== PLAYERS ====================
create table if not exists public.player_profiles (
  id text primary key,
  owner_uid uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

alter table public.player_profiles add column if not exists owner_uid uuid references auth.users(id) on delete cascade;
create unique index if not exists player_profiles_owner_uid_idx on public.player_profiles(owner_uid) where owner_uid is not null;
create index if not exists player_profiles_rank_idx on public.player_profiles(level desc, total_earned desc);
create index if not exists player_profiles_last_seen_idx on public.player_profiles(last_seen desc);

create or replace function public.autosyndicate_profile_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_db_admin boolean := session_user in ('postgres', 'supabase_admin');
  v_jwt_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    case
      when nullif(current_setting('request.jwt.claims', true), '') is not null
      then (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
      else null
    end,
    ''
  );
begin
  -- Supabase SQL Editor/migrations run as postgres and do not have auth.uid().
  -- service_role requests are also privileged. Browser anon requests remain blocked.
  if v_uid is null and not v_db_admin and v_jwt_role <> 'service_role' then
    raise exception 'authentication required';
  end if;

  if tg_op = 'INSERT' then
    if v_uid is not null then
      new.owner_uid := v_uid;
    elsif new.owner_uid is null then
      raise exception 'owner_uid is required for privileged insert';
    end if;
  else
    if not v_db_admin and v_jwt_role <> 'service_role' then
      if old.owner_uid is null or old.owner_uid <> v_uid then
        raise exception 'profile is not owned by current session';
      end if;
    end if;
    new.id := old.id;
    new.owner_uid := old.owner_uid;
  end if;

  new.id := left(trim(coalesce(new.id,'')), 90);
  if new.id !~ '^(tg_[0-9]{1,24}|guest_[A-Za-z0-9-]{8,80})$' then
    raise exception 'invalid player id';
  end if;

  new.name := left(regexp_replace(trim(coalesce(new.name,'Гонщик')), '[[:cntrl:]]', '', 'g'), 48);
  if new.name = '' then new.name := 'Гонщик'; end if;
  if new.photo_url is not null and new.photo_url !~ '^https://[^[:space:]]+$' then new.photo_url := null; end if;
  new.level := greatest(1, least(coalesce(new.level,1), 500));
  new.balance := greatest(0, least(coalesce(new.balance,0), 1000000000000));
  new.xp := greatest(0, least(coalesce(new.xp,0), 2000000000));
  new.races := greatest(0, least(coalesce(new.races,0), 2000000000));
  new.wins := greatest(0, least(coalesce(new.wins,0), new.races));
  new.losses := greatest(0, least(coalesce(new.losses,0), new.races));
  new.total_earned := greatest(0, least(coalesce(new.total_earned,0), 1000000000000));
  if cardinality(coalesce(new.owned_cars,'{}'::integer[])) > 100 then
    new.owned_cars := new.owned_cars[1:100];
  end if;
  new.active_car_id := greatest(1, least(coalesce(new.active_car_id,1), 100000));
  new.last_seen := now();
  return new;
end;
$$;

drop trigger if exists trg_autosyndicate_profile_guard on public.player_profiles;
create trigger trg_autosyndicate_profile_guard
before insert or update on public.player_profiles
for each row execute function public.autosyndicate_profile_guard();

alter table public.player_profiles enable row level security;
drop policy if exists player_profiles_select on public.player_profiles;
drop policy if exists player_profiles_insert on public.player_profiles;
drop policy if exists player_profiles_update on public.player_profiles;
drop policy if exists "player_profiles_select" on public.player_profiles;
drop policy if exists "player_profiles_insert" on public.player_profiles;
drop policy if exists "player_profiles_update" on public.player_profiles;
create policy player_profiles_select on public.player_profiles for select to anon, authenticated using (true);
create policy player_profiles_insert on public.player_profiles for insert to authenticated with check (owner_uid = auth.uid());
create policy player_profiles_update on public.player_profiles for update to authenticated using (owner_uid = auth.uid()) with check (owner_uid = auth.uid());

-- ==================== MARKET ====================
create table if not exists public.market_cars (
  id bigint generated by default as identity primary key,
  seller_uid uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seller_id text not null,
  seller_name text not null,
  car_id text not null,
  price bigint not null,
  vehicle_data jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  buyer_uid uuid references auth.users(id) on delete set null,
  buyer_id text,
  buyer_name text,
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  settled_at timestamptz
);
alter table public.market_cars add column if not exists seller_uid uuid references auth.users(id) on delete cascade;
alter table public.market_cars add column if not exists buyer_uid uuid references auth.users(id) on delete set null;
alter table public.market_cars add column if not exists buyer_name text;
alter table public.market_cars add column if not exists vehicle_data jsonb not null default '{}'::jsonb;
alter table public.market_cars add column if not exists created_at timestamptz not null default now();
alter table public.market_cars add column if not exists sold_at timestamptz;
alter table public.market_cars add column if not exists settled_at timestamptz;
create index if not exists market_cars_status_idx on public.market_cars(status,id desc);
create index if not exists market_cars_seller_idx on public.market_cars(seller_id,id desc);
create index if not exists market_cars_buyer_idx on public.market_cars(buyer_id,id desc);

create or replace function public.autosyndicate_market_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.player_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  if tg_op = 'INSERT' then
    select * into p from public.player_profiles where owner_uid = auth.uid() limit 1;
    if p.id is null then raise exception 'profile sync required'; end if;
    if coalesce(new.car_id,'') !~ '^[0-9]{1,6}$' then raise exception 'invalid car id'; end if;
    if coalesce(new.price,0) < 1 or new.price > 2000000 then raise exception 'invalid price'; end if;
    if jsonb_typeof(coalesce(new.vehicle_data,'{}'::jsonb)) <> 'object' then raise exception 'invalid vehicle data'; end if;
    if octet_length(coalesce(new.vehicle_data,'{}'::jsonb)::text) > 12000 then raise exception 'vehicle data too large'; end if;
    if new.vehicle_data <> '{}'::jsonb then
      if coalesce(new.vehicle_data->>'carId','') !~ '^[0-9]{1,6}$' or (new.vehicle_data->>'carId')::text <> new.car_id then raise exception 'vehicle car mismatch'; end if;
      if least(
        coalesce((new.vehicle_data#>>'{upgrades,engine}')::int,0),
        coalesce((new.vehicle_data#>>'{upgrades,turbo}')::int,0),
        coalesce((new.vehicle_data#>>'{upgrades,gearbox}')::int,0),
        coalesce((new.vehicle_data#>>'{upgrades,tires}')::int,0)
      ) < 0 or greatest(
        coalesce((new.vehicle_data#>>'{upgrades,engine}')::int,0),
        coalesce((new.vehicle_data#>>'{upgrades,turbo}')::int,0),
        coalesce((new.vehicle_data#>>'{upgrades,gearbox}')::int,0),
        coalesce((new.vehicle_data#>>'{upgrades,tires}')::int,0)
      ) > 5 then raise exception 'invalid vehicle upgrades'; end if;
      if coalesce(new.vehicle_data->>'fuel','100') !~ '^[0-9]{1,3}([.][0-9]+)?$'
         or coalesce(new.vehicle_data->>'condition','100') !~ '^[0-9]{1,3}([.][0-9]+)?$'
         or (coalesce(new.vehicle_data->>'fuel','100'))::numeric not between 0 and 100
         or (coalesce(new.vehicle_data->>'condition','100'))::numeric not between 0 and 100 then
        raise exception 'invalid vehicle condition';
      end if;
    end if;
    new.seller_uid := auth.uid(); new.seller_id := p.id; new.seller_name := p.name;
    new.status := 'active'; new.buyer_uid := null; new.buyer_id := null; new.buyer_name := null;
    new.created_at := now(); new.sold_at := null; new.settled_at := null;
    return new;
  end if;

  new.seller_uid := old.seller_uid; new.seller_id := old.seller_id; new.seller_name := old.seller_name;
  new.car_id := old.car_id; new.price := old.price; new.vehicle_data := old.vehicle_data; new.created_at := old.created_at;

  if old.status = 'active' and new.status = 'cancelled' then
    if old.seller_uid <> auth.uid() then raise exception 'only seller can cancel'; end if;
    new.buyer_uid := null; new.buyer_id := null; new.buyer_name := null; new.sold_at := null;
    return new;
  elsif old.status = 'active' and new.status = 'sold' then
    if old.seller_uid = auth.uid() then raise exception 'cannot buy own listing'; end if;
    select * into p from public.player_profiles where owner_uid = auth.uid() limit 1;
    if p.id is null then raise exception 'profile sync required'; end if;
    new.buyer_uid := auth.uid(); new.buyer_id := p.id; new.buyer_name := p.name; new.sold_at := now(); new.settled_at := null;
    return new;
  elsif old.status = 'sold' and new.status = 'settled' then
    if old.seller_uid <> auth.uid() then raise exception 'only seller can settle'; end if;
    new.buyer_uid := old.buyer_uid; new.buyer_id := old.buyer_id; new.buyer_name := old.buyer_name;
    new.sold_at := old.sold_at; new.settled_at := now();
    return new;
  end if;

  raise exception 'invalid market transition % -> %', old.status, new.status;
end;
$$;

drop trigger if exists trg_autosyndicate_market_guard on public.market_cars;
create trigger trg_autosyndicate_market_guard before insert or update on public.market_cars
for each row execute function public.autosyndicate_market_guard();

alter table public.market_cars enable row level security;
drop policy if exists market_cars_select on public.market_cars;
drop policy if exists market_cars_insert on public.market_cars;
drop policy if exists market_cars_update on public.market_cars;
create policy market_cars_select on public.market_cars for select to anon, authenticated using (true);
create policy market_cars_insert on public.market_cars for insert to authenticated with check (seller_uid = auth.uid());
create policy market_cars_update on public.market_cars for update to authenticated
using (seller_uid = auth.uid() or buyer_uid = auth.uid() or (status='active' and seller_uid <> auth.uid()))
with check (seller_uid = auth.uid() or buyer_uid = auth.uid());

-- ==================== CHAT ====================
create table if not exists public.chat_messages (
  id bigint generated by default as identity primary key,
  sender_uid uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages add column if not exists sender_uid uuid references auth.users(id) on delete cascade;
alter table public.chat_messages add column if not exists created_at timestamptz not null default now();
create index if not exists chat_messages_created_idx on public.chat_messages(created_at desc);
create index if not exists chat_messages_sender_idx on public.chat_messages(sender_uid,created_at desc);

create or replace function public.autosyndicate_chat_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.player_profiles%rowtype;
  recent_count integer;
  last_sent timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into p from public.player_profiles where owner_uid=auth.uid() limit 1;
  if p.id is null then raise exception 'profile sync required'; end if;

  new.message := left(regexp_replace(trim(coalesce(new.message,'')), '[[:cntrl:]]', ' ', 'g'), 300);
  if new.message = '' then raise exception 'empty message'; end if;
  select max(created_at), count(*) filter (where created_at > now()-interval '1 minute')
    into last_sent, recent_count from public.chat_messages where sender_uid=auth.uid();
  if last_sent is not null and last_sent > now()-interval '2.5 seconds' then raise exception 'chat rate limit'; end if;
  if recent_count >= 8 then raise exception 'chat minute limit'; end if;

  new.sender_uid := auth.uid(); new.user_name := p.name; new.created_at := now();
  return new;
end;
$$;

drop trigger if exists trg_autosyndicate_chat_guard on public.chat_messages;
create trigger trg_autosyndicate_chat_guard before insert on public.chat_messages
for each row execute function public.autosyndicate_chat_guard();

alter table public.chat_messages enable row level security;
drop policy if exists chat_messages_select on public.chat_messages;
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select to anon, authenticated using (true);
create policy chat_messages_insert on public.chat_messages for insert to authenticated with check (sender_uid=auth.uid());

-- ==================== BANK ====================
create table if not exists public.bank_transfers (
  id bigint generated by default as identity primary key,
  sender_uid uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_id text not null,
  sender_name text not null,
  receiver_uid uuid not null references auth.users(id) on delete cascade,
  receiver_id text not null,
  amount integer not null,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.bank_transfers add column if not exists sender_uid uuid references auth.users(id) on delete cascade;
alter table public.bank_transfers add column if not exists receiver_uid uuid references auth.users(id) on delete cascade;
alter table public.bank_transfers add column if not exists claimed boolean not null default false;
alter table public.bank_transfers add column if not exists created_at timestamptz not null default now();
alter table public.bank_transfers add column if not exists claimed_at timestamptz;
create index if not exists bank_transfers_sender_idx on public.bank_transfers(sender_uid,created_at desc);
create index if not exists bank_transfers_receiver_idx on public.bank_transfers(receiver_uid,claimed,id desc);

create or replace function public.autosyndicate_bank_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender public.player_profiles%rowtype;
  receiver public.player_profiles%rowtype;
  sent_24h bigint;
  last_to timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  if tg_op='INSERT' then
    select * into sender from public.player_profiles where owner_uid=auth.uid() limit 1;
    select * into receiver from public.player_profiles where id=trim(coalesce(new.receiver_id,'')) and owner_uid is not null limit 1;
    if sender.id is null or receiver.id is null then raise exception 'sender or receiver profile missing'; end if;
    if sender.id=receiver.id then raise exception 'cannot transfer to self'; end if;
    if coalesce(new.amount,0)<1 or new.amount>800 then raise exception 'transfer limit exceeded'; end if;

    select coalesce(sum(amount),0) into sent_24h from public.bank_transfers
      where sender_uid=auth.uid() and created_at>now()-interval '24 hours';
    if sent_24h + new.amount > 2000 then raise exception 'daily transfer limit exceeded'; end if;
    select max(created_at) into last_to from public.bank_transfers
      where sender_uid=auth.uid() and receiver_uid=receiver.owner_uid;
    if last_to is not null and last_to>now()-interval '10 minutes' then raise exception 'receiver cooldown'; end if;

    new.sender_uid:=auth.uid(); new.sender_id:=sender.id; new.sender_name:=sender.name;
    new.receiver_uid:=receiver.owner_uid; new.receiver_id:=receiver.id;
    new.claimed:=false; new.created_at:=now(); new.claimed_at:=null;
    return new;
  end if;

  if old.receiver_uid<>auth.uid() or old.claimed then raise exception 'transfer cannot be claimed'; end if;
  if new.claimed is not true then raise exception 'only claim transition is allowed'; end if;
  new.sender_uid:=old.sender_uid; new.sender_id:=old.sender_id; new.sender_name:=old.sender_name;
  new.receiver_uid:=old.receiver_uid; new.receiver_id:=old.receiver_id; new.amount:=old.amount;
  new.created_at:=old.created_at; new.claimed:=true; new.claimed_at:=now();
  return new;
end;
$$;

drop trigger if exists trg_autosyndicate_bank_guard on public.bank_transfers;
create trigger trg_autosyndicate_bank_guard before insert or update on public.bank_transfers
for each row execute function public.autosyndicate_bank_guard();

alter table public.bank_transfers enable row level security;
drop policy if exists bank_transfers_select on public.bank_transfers;
drop policy if exists bank_transfers_insert on public.bank_transfers;
drop policy if exists bank_transfers_update on public.bank_transfers;
create policy bank_transfers_select on public.bank_transfers for select to authenticated using (sender_uid=auth.uid() or receiver_uid=auth.uid());
create policy bank_transfers_insert on public.bank_transfers for insert to authenticated with check (sender_uid=auth.uid());
create policy bank_transfers_update on public.bank_transfers for update to authenticated using (receiver_uid=auth.uid()) with check (receiver_uid=auth.uid());

-- ==================== PVP ====================
create table if not exists public.pvp_challenges (
  id bigint generated by default as identity primary key,
  challenger_uid uuid not null default auth.uid() references auth.users(id) on delete cascade,
  challenger_id text not null,
  challenger_name text not null,
  accepter_uid uuid references auth.users(id) on delete set null,
  accepter_id text,
  accepter_name text,
  power integer not null,
  stake integer not null,
  status text not null default 'open',
  winner_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  settled_at timestamptz
);
alter table public.pvp_challenges add column if not exists challenger_uid uuid references auth.users(id) on delete cascade;
alter table public.pvp_challenges add column if not exists accepter_uid uuid references auth.users(id) on delete set null;
alter table public.pvp_challenges add column if not exists created_at timestamptz not null default now();
alter table public.pvp_challenges add column if not exists resolved_at timestamptz;
alter table public.pvp_challenges add column if not exists settled_at timestamptz;
create index if not exists pvp_challenges_status_idx on public.pvp_challenges(status,id desc);
create index if not exists pvp_challenges_challenger_idx on public.pvp_challenges(challenger_uid,id desc);

create or replace function public.autosyndicate_pvp_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.player_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  if tg_op='INSERT' then
    select * into p from public.player_profiles where owner_uid=auth.uid() limit 1;
    if p.id is null then raise exception 'profile sync required'; end if;
    if coalesce(new.stake,0)<1 or new.stake>25000 then raise exception 'invalid stake'; end if;
    new.challenger_uid:=auth.uid(); new.challenger_id:=p.id; new.challenger_name:=p.name;
    new.power:=greatest(50,least(coalesce(new.power,50),3000)); new.status:='open';
    new.accepter_uid:=null; new.accepter_id:=null; new.accepter_name:=null; new.winner_id:=null;
    new.created_at:=now(); new.resolved_at:=null; new.settled_at:=null;
    return new;
  end if;

  new.challenger_uid:=old.challenger_uid; new.challenger_id:=old.challenger_id; new.challenger_name:=old.challenger_name;
  new.power:=old.power; new.stake:=old.stake; new.created_at:=old.created_at;

  if old.status='open' and new.status='cancelled' then
    if old.challenger_uid<>auth.uid() then raise exception 'only challenger can cancel'; end if;
    new.accepter_uid:=null; new.accepter_id:=null; new.accepter_name:=null; new.winner_id:=null;
    return new;
  elsif old.status='open' and new.status='racing' then
    if old.challenger_uid=auth.uid() then raise exception 'cannot accept own challenge'; end if;
    select * into p from public.player_profiles where owner_uid=auth.uid() limit 1;
    if p.id is null then raise exception 'profile sync required'; end if;
    new.accepter_uid:=auth.uid(); new.accepter_id:=p.id; new.accepter_name:=p.name; new.winner_id:=null;
    return new;
  elsif old.status='racing' and new.status='resolved' then
    if old.accepter_uid is null or old.accepter_uid<>auth.uid() then raise exception 'only accepter can resolve'; end if;
    if new.winner_id is distinct from old.challenger_id and new.winner_id is distinct from old.accepter_id then
      raise exception 'invalid winner';
    end if;
    new.accepter_uid:=old.accepter_uid; new.accepter_id:=old.accepter_id; new.accepter_name:=old.accepter_name;
    new.resolved_at:=now(); new.settled_at:=null;
    return new;
  elsif old.status='resolved' and new.status='settled' then
    if old.challenger_uid<>auth.uid() then raise exception 'only challenger can settle'; end if;
    new.accepter_uid:=old.accepter_uid; new.accepter_id:=old.accepter_id; new.accepter_name:=old.accepter_name;
    new.winner_id:=old.winner_id; new.resolved_at:=old.resolved_at; new.settled_at:=now();
    return new;
  end if;

  raise exception 'invalid pvp transition % -> %', old.status, new.status;
end;
$$;

drop trigger if exists trg_autosyndicate_pvp_guard on public.pvp_challenges;
create trigger trg_autosyndicate_pvp_guard before insert or update on public.pvp_challenges
for each row execute function public.autosyndicate_pvp_guard();

alter table public.pvp_challenges enable row level security;
drop policy if exists pvp_challenges_select on public.pvp_challenges;
drop policy if exists pvp_challenges_insert on public.pvp_challenges;
drop policy if exists pvp_challenges_update on public.pvp_challenges;
create policy pvp_challenges_select on public.pvp_challenges for select to authenticated using (true);
create policy pvp_challenges_insert on public.pvp_challenges for insert to authenticated with check (challenger_uid=auth.uid());
create policy pvp_challenges_update on public.pvp_challenges for update to authenticated using (true) with check (true);


-- ==================== REFERRALS ====================
alter table public.player_profiles add column if not exists referral_code text;
update public.player_profiles
set referral_code = upper(substr(md5(id),1,10))
where referral_code is null or referral_code = '';
create unique index if not exists player_profiles_referral_code_idx on public.player_profiles(referral_code) where referral_code is not null;

create or replace function public.autosyndicate_referral_code_guard()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    new.referral_code := upper(substr(md5(new.id),1,10));
  else
    new.referral_code := old.referral_code;
    if new.total_earned < old.total_earned then new.total_earned := old.total_earned; end if;
    if new.races < old.races then new.races := old.races; end if;
    if new.wins < old.wins then new.wins := old.wins; end if;
    if new.losses < old.losses then new.losses := old.losses; end if;
    if new.total_earned-old.total_earned > 250000 then raise exception 'earned delta too large'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_autosyndicate_referral_code on public.player_profiles;
create trigger trg_autosyndicate_referral_code
before insert or update on public.player_profiles
for each row execute function public.autosyndicate_referral_code_guard();

create table if not exists public.referrals (
  invitee_uid uuid primary key references auth.users(id) on delete cascade,
  inviter_uid uuid not null references auth.users(id) on delete cascade,
  invitee_id text not null,
  inviter_id text not null,
  percent numeric(5,2) not null default 5.00 check (percent >= 0 and percent <= 10),
  start_bonus_claimed boolean not null default false,
  first_race_bonus_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  check (invitee_uid <> inviter_uid),
  unique(invitee_id)
);
create index if not exists referrals_inviter_uid_idx on public.referrals(inviter_uid,created_at desc);

create table if not exists public.referral_earnings (
  id bigint generated by default as identity primary key,
  inviter_uid uuid not null references auth.users(id) on delete cascade,
  invitee_uid uuid not null references auth.users(id) on delete cascade,
  source_total_earned bigint not null,
  source_delta bigint not null check (source_delta > 0),
  amount bigint not null check (amount >= 0),
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique(invitee_uid,source_total_earned)
);
create index if not exists referral_earnings_claim_idx on public.referral_earnings(inviter_uid,claimed,id);

create or replace function public.autosyndicate_bind_referrer(p_referral_code text)
returns table(bound boolean, invitee_bonus bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  me public.player_profiles%rowtype;
  inviter public.player_profiles%rowtype;
  existing public.referrals%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into me from public.player_profiles where owner_uid=auth.uid() limit 1;
  if me.id is null then raise exception 'profile sync required'; end if;
  select * into existing from public.referrals where invitee_uid=auth.uid();
  if existing.invitee_uid is not null then return query select true,0::bigint; return; end if;
  select * into inviter from public.player_profiles where referral_code=upper(trim(coalesce(p_referral_code,''))) limit 1;
  if inviter.id is null then return query select false,0::bigint; return; end if;
  if inviter.owner_uid=auth.uid() or inviter.id=me.id then raise exception 'self referral is forbidden'; end if;
  insert into public.referrals(invitee_uid,inviter_uid,invitee_id,inviter_id,start_bonus_claimed)
  values(auth.uid(),inviter.owner_uid,me.id,inviter.id,true);
  return query select true,500::bigint;
end;
$$;

create or replace function public.autosyndicate_referral_earning_guard()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.referrals%rowtype;
  delta bigint;
  reward bigint;
begin
  if new.total_earned <= old.total_earned then return new; end if;
  select * into r from public.referrals where invitee_uid=new.owner_uid;
  if r.invitee_uid is null then return new; end if;
  delta := new.total_earned-old.total_earned;
  reward := floor(delta*(r.percent/100.0));
  if reward <= 0 then return new; end if;
  insert into public.referral_earnings(inviter_uid,invitee_uid,source_total_earned,source_delta,amount)
  values(r.inviter_uid,r.invitee_uid,new.total_earned,delta,reward)
  on conflict(invitee_uid,source_total_earned) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_autosyndicate_referral_earnings on public.player_profiles;
create trigger trg_autosyndicate_referral_earnings
after update of total_earned on public.player_profiles
for each row execute function public.autosyndicate_referral_earning_guard();

create or replace function public.autosyndicate_claim_first_race_bonus()
returns table(bonus bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  me public.player_profiles%rowtype;
  r public.referrals%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into me from public.player_profiles where owner_uid=auth.uid() limit 1;
  if me.id is null or me.races < 1 then return query select 0::bigint; return; end if;
  select * into r from public.referrals where invitee_uid=auth.uid() for update;
  if r.invitee_uid is null or r.first_race_bonus_claimed then return query select 0::bigint; return; end if;
  update public.referrals set first_race_bonus_claimed=true where invitee_uid=auth.uid();
  return query select 300::bigint;
end;
$$;

create or replace function public.autosyndicate_claim_referral_rewards()
returns table(amount bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  total bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  with claimed_rows as (
    update public.referral_earnings
      set claimed=true, claimed_at=now()
    where inviter_uid=auth.uid() and claimed=false
    returning amount
  ) select coalesce(sum(claimed_rows.amount),0)::bigint into total from claimed_rows;
  return query select coalesce(total,0)::bigint;
end;
$$;

create or replace function public.autosyndicate_referral_dashboard()
returns table(referral_code text,has_referrer boolean,invites bigint,total_earned bigint)
language sql
security definer
set search_path=public
as $$
  select p.referral_code,
         exists(select 1 from public.referrals r where r.invitee_uid=auth.uid()) as has_referrer,
         (select count(*)::bigint from public.referrals r where r.inviter_uid=auth.uid()) as invites,
         (select coalesce(sum(e.amount),0)::bigint from public.referral_earnings e where e.inviter_uid=auth.uid()) as total_earned
  from public.player_profiles p
  where p.owner_uid=auth.uid()
  limit 1;
$$;

alter table public.referrals enable row level security;
alter table public.referral_earnings enable row level security;
drop policy if exists referrals_select_own on public.referrals;
create policy referrals_select_own on public.referrals for select to authenticated
using (invitee_uid=auth.uid() or inviter_uid=auth.uid());
drop policy if exists referral_earnings_select_own on public.referral_earnings;
create policy referral_earnings_select_own on public.referral_earnings for select to authenticated
using (inviter_uid=auth.uid() or invitee_uid=auth.uid());
revoke insert,update,delete on public.referrals,public.referral_earnings from anon,authenticated;
grant select on public.referrals,public.referral_earnings to authenticated;
grant execute on function public.autosyndicate_bind_referrer(text) to authenticated;
grant execute on function public.autosyndicate_claim_first_race_bonus() to authenticated;
grant execute on function public.autosyndicate_claim_referral_rewards() to authenticated;
grant execute on function public.autosyndicate_referral_dashboard() to authenticated;

-- Permissions: public reads where intended, authenticated writes only.
grant select on public.player_profiles, public.market_cars, public.chat_messages to anon, authenticated;
grant select on public.bank_transfers, public.pvp_challenges to authenticated;
grant insert, update on public.player_profiles, public.market_cars, public.bank_transfers, public.pvp_challenges to authenticated;
grant insert on public.chat_messages to authenticated;
revoke insert, update, delete on public.player_profiles, public.market_cars, public.chat_messages, public.bank_transfers, public.pvp_challenges from anon;
revoke delete on public.player_profiles, public.market_cars, public.chat_messages, public.bank_transfers, public.pvp_challenges from authenticated;

do $$
begin
  grant usage, select on sequence public.market_cars_id_seq to authenticated;
exception when undefined_table or undefined_object then null;
end $$;
do $$
begin
  grant usage, select on sequence public.chat_messages_id_seq to authenticated;
exception when undefined_table or undefined_object then null;
end $$;
do $$
begin
  grant usage, select on sequence public.bank_transfers_id_seq to authenticated;
exception when undefined_table or undefined_object then null;
end $$;
do $$
begin
  grant usage, select on sequence public.pvp_challenges_id_seq to authenticated;
exception when undefined_table or undefined_object then null;
end $$;
do $$
begin
  grant usage, select on sequence public.referral_earnings_id_seq to authenticated;
exception when undefined_table or undefined_object then null;
end $$;

-- Realtime for market + chat + PvP. Safe to re-run.
do $$ begin
  alter publication supabase_realtime add table public.market_cars;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pvp_challenges;
exception when duplicate_object or undefined_object then null; end $$;

commit;

-- Legacy rows created before v5 may have owner_uid = NULL and intentionally become read-only.
-- During development, if you do not need old online data, clear those legacy rows once:
-- delete from public.market_cars where seller_uid is null;
-- delete from public.chat_messages where sender_uid is null;
-- delete from public.bank_transfers where sender_uid is null or receiver_uid is null;
-- delete from public.pvp_challenges where challenger_uid is null;
-- delete from public.player_profiles where owner_uid is null;
