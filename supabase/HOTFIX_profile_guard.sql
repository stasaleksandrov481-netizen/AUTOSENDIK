-- AutoSyndicate Carbon v8 — hotfix for Supabase SQL Editor migrations
-- Safe to run before re-running schema_v8.sql.

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
