-- Launch 4: coaching products + own scheduler + Google Calendar (G18, G19).
-- Additive. Mirrors src/lib/data/types.ts (Coaching section), src/lib/data/fake (coaching repo)
-- and src/features/coaching/api/{schedule,booking,studio}.ts.
-- Kajabi: https://help.kajabi.com/articles/products/coaching/kajabi-scheduler-overview
-- - one schedule per space (the instructor); weekly windows + date overrides in the coach's zone;
-- - 1:1 programs: clients book their own sessions, up to sessions_included per grant;
-- - group programs: the coach schedules, every holder of the product sees the session;
-- - no two scheduled sessions of a space overlap (exclusion constraint);
-- - notes are staff only; the Google refresh token lives in Vault.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create function public.is_time_zone(zone text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names z where z.name = zone);
$$;

create table public.coaching_programs (
  product_id uuid primary key references public.products (id) on delete cascade,
  kind text not null default 'one_on_one' constraint coaching_programs_kind check (kind in ('one_on_one', 'group')),
  session_minutes integer not null default 60 constraint coaching_programs_minutes check (session_minutes between 15 and 360),
  sessions_included integer not null default 1 constraint coaching_programs_included check (sessions_included >= 1),
  location text constraint coaching_programs_location check (location is null or location ~ '^https://')
);

create table public.coach_settings (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  time_zone text not null default 'UTC',
  buffer_before_min integer not null default 0 check (buffer_before_min >= 0),
  buffer_after_min integer not null default 0 check (buffer_after_min >= 0),
  min_notice_min integer not null default 240 check (min_notice_min >= 0),
  window_days integer not null default 14 constraint coach_settings_window check (window_days between 1 and 200),
  cancel_cutoff_hours integer not null default 24 check (cancel_cutoff_hours >= 0)
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  weekday smallint not null constraint availability_rules_weekday check (weekday between 0 and 6),
  start_minute smallint not null,
  end_minute smallint not null,
  constraint availability_rules_window check (0 <= start_minute and start_minute < end_minute and end_minute <= 1440)
);
create index availability_rules_space on public.availability_rules (space_id, weekday, start_minute);

-- Replaces the weekly rules on one local date; both minutes null = unavailable all day.
create table public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  date date not null,
  start_minute smallint,
  end_minute smallint,
  constraint availability_overrides_window check (
    -- Both null = day off; both set = a window. NULL comparisons pass a check, hence the explicit pairing.
    (start_minute is null and end_minute is null)
    or (start_minute is not null and end_minute is not null
        and 0 <= start_minute and start_minute < end_minute and end_minute <= 1440)
  )
);
create index availability_overrides_space on public.availability_overrides (space_id, date);

create table public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- null = group session for every holder of the product.
  client_id uuid references public.profiles (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' constraint coaching_sessions_status check (status in ('scheduled', 'cancelled')),
  agenda text not null default '' check (length(agenda) <= 2000),
  location text constraint coaching_sessions_location check (location is null or location ~ '^https://'),
  google_event_id text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint coaching_sessions_range check (ends_at > starts_at),
  constraint coaching_sessions_cancelled check ((status = 'cancelled') = (cancelled_at is not null)),
  -- One coach per space: scheduled sessions never overlap (G19).
  constraint coaching_sessions_no_overlap exclude using gist (
    space_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status = 'scheduled')
);
create index coaching_sessions_product on public.coaching_sessions (product_id, starts_at);
create index coaching_sessions_client on public.coaching_sessions (client_id, starts_at) where client_id is not null;

create table public.session_notes (
  session_id uuid primary key references public.coaching_sessions (id) on delete cascade,
  body text not null check (length(body) <= 20000),
  updated_at timestamptz not null default now()
);

-- One Google Calendar per space. The refresh token is in Vault; only its id is here.
create table public.calendar_connections (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  account_email text not null check (position('@' in account_email) > 1),
  calendar_id text not null check (length(trim(calendar_id)) > 0),
  token_id uuid,
  connected_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shape guards
-- ---------------------------------------------------------------------------

-- Program rows only on coaching products.
create function public.coaching_program_matches() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select p.kind from public.products p where p.id = new.product_id) is distinct from 'coaching' then
    raise exception 'coaching program needs a coaching product' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger coaching_programs_kind before insert or update on public.coaching_programs
  for each row execute function public.coaching_program_matches();

create function public.coach_settings_zone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_time_zone(new.time_zone) then
    raise exception 'unknown time zone' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger coach_settings_zone before insert or update on public.coach_settings
  for each row execute function public.coach_settings_zone();

-- Session: coaching product of the same space.
create function public.coaching_session_matches() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
begin
  select * into p from public.products where id = new.product_id;
  if p.kind is distinct from 'coaching' or p.space_id is distinct from new.space_id then
    raise exception 'session needs a coaching product of the space' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger coaching_sessions_matches before insert or update of product_id, space_id on public.coaching_sessions
  for each row execute function public.coaching_session_matches();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.coaching_programs enable row level security;
alter table public.coach_settings enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.coaching_sessions enable row level security;
alter table public.session_notes enable row level security;
alter table public.calendar_connections enable row level security;

-- Program settings: readable with the product, written by products.edit.
create policy coaching_programs_read on public.coaching_programs for select
  using (exists (select 1 from public.products p where p.id = product_id));
create policy coaching_programs_write on public.coaching_programs for all
  using (public.has_capability(public.product_space(product_id), 'products.edit'))
  with check (public.has_capability(public.product_space(product_id), 'products.edit'));

-- Schedule: participants read (clients see the zone and cutoff), products.edit writes.
create policy coach_settings_read on public.coach_settings for select
  using (public.is_space_participant(space_id));
create policy coach_settings_write on public.coach_settings for all
  using (public.has_capability(space_id, 'products.edit'))
  with check (public.has_capability(space_id, 'products.edit'));
create policy availability_rules_read on public.availability_rules for select
  using (public.is_space_participant(space_id));
create policy availability_rules_write on public.availability_rules for all
  using (public.has_capability(space_id, 'products.edit'))
  with check (public.has_capability(space_id, 'products.edit'));
create policy availability_overrides_read on public.availability_overrides for select
  using (public.is_space_participant(space_id));
create policy availability_overrides_write on public.availability_overrides for all
  using (public.has_capability(space_id, 'products.edit'))
  with check (public.has_capability(space_id, 'products.edit'));

-- Sessions: staff all; clients their own 1:1 sessions and group sessions of products they hold.
-- Clients book via book_coaching_session and change via change_coaching_session (no direct writes).
create policy coaching_sessions_read on public.coaching_sessions for select
  using (
    public.has_capability(space_id, 'products.edit')
    or (public.has_grant(product_id) and (client_id is null or client_id = auth.uid()))
  );
create policy coaching_sessions_write on public.coaching_sessions for all
  using (public.has_capability(space_id, 'products.edit'))
  with check (public.has_capability(space_id, 'products.edit'));

-- Busy time of the space for the slot engine, without other clients' details.
create function public.coaching_busy(target_space uuid, from_at timestamptz, to_at timestamptz)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.starts_at, s.ends_at from public.coaching_sessions s
  where public.is_space_participant(target_space)
    and s.space_id = target_space and s.status = 'scheduled'
    and s.ends_at > from_at and s.starts_at < to_at
  order by s.starts_at;
$$;

-- Notes: staff only.
create policy session_notes_all on public.session_notes for all
  using (public.has_capability((select s.space_id from public.coaching_sessions s where s.id = session_id), 'products.edit'))
  with check (public.has_capability((select s.space_id from public.coaching_sessions s where s.id = session_id), 'products.edit'));

-- Calendar: staff read (sync state in Studio), settings.manage connects/disconnects. Token never readable.
create policy calendar_connections_read on public.calendar_connections for select
  using (public.has_capability(space_id, 'products.edit'));
create policy calendar_connections_delete on public.calendar_connections for delete
  using (public.has_capability(space_id, 'settings.manage'));

-- ---------------------------------------------------------------------------
-- Client RPCs
-- ---------------------------------------------------------------------------

-- Atomic client booking (repo.bookCoachingSession). Locks the program row so two bookings of
-- the same client cannot both pass the balance check; overlap is the exclusion constraint.
-- The app checks the slot against the availability grid first (booking.ts).
create function public.book_coaching_session(
  target_product uuid, starts timestamptz, ends timestamptz, agenda text
) returns public.coaching_sessions
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  prog public.coaching_programs;
  prod public.products;
  used integer;
  booked public.coaching_sessions;
begin
  if me is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  select * into prog from public.coaching_programs where product_id = target_product for update;
  select * into prod from public.products where id = target_product;
  if prog.product_id is null or prod.status <> 'published' then
    raise exception 'no such coaching product' using errcode = '23503';
  end if;
  if prog.kind <> 'one_on_one' then
    raise exception 'group sessions are scheduled by the coach' using errcode = '23514';
  end if;
  if not public.has_grant(target_product) then
    raise exception 'no access to this coaching product' using errcode = '42501';
  end if;
  select count(*) into used from public.coaching_sessions s
  where s.product_id = target_product and s.client_id = me and s.status = 'scheduled';
  if used >= prog.sessions_included then
    raise exception 'no sessions left' using errcode = '23514';
  end if;
  if ends - starts <> make_interval(mins => prog.session_minutes) or starts <= now() then
    raise exception 'session must be one program length in the future' using errcode = '23514';
  end if;
  insert into public.coaching_sessions (product_id, space_id, client_id, title, starts_at, ends_at, agenda, location)
  values (target_product, prod.space_id, me, prod.title, starts, ends, trim(coalesce(agenda, '')), prog.location)
  returning * into booked;
  return booked;
end;
$$;

-- Client reschedule (new start, same length) or cancel (new_start null), before the cutoff.
create function public.change_coaching_session(target_session uuid, new_start timestamptz)
returns public.coaching_sessions
language plpgsql security definer set search_path = '' as $$
declare
  s public.coaching_sessions;
  cutoff integer;
begin
  select * into s from public.coaching_sessions where id = target_session for update;
  if s.id is null or s.client_id is distinct from auth.uid() then
    raise exception 'no such session' using errcode = '23503';
  end if;
  select coalesce((select c.cancel_cutoff_hours from public.coach_settings c where c.space_id = s.space_id), 24) into cutoff;
  if s.status <> 'scheduled' or s.starts_at - now() < make_interval(hours => cutoff) then
    raise exception 'sessions can be changed until % hours before they start', cutoff using errcode = '23514';
  end if;
  if new_start is null then
    update public.coaching_sessions set status = 'cancelled', cancelled_at = now() where id = s.id returning * into s;
  else
    if new_start <= now() then
      raise exception 'new time must be in the future' using errcode = '23514';
    end if;
    update public.coaching_sessions
    set starts_at = new_start, ends_at = new_start + (s.ends_at - s.starts_at)
    where id = s.id returning * into s;
  end if;
  return s;
end;
$$;

-- Google sync result, written by the server after a client action (event id only).
create function public.set_session_event(target_session uuid, event_id text) returns void
language sql security definer set search_path = '' as $$
  update public.coaching_sessions set google_event_id = event_id where id = target_session;
$$;

-- ---------------------------------------------------------------------------
-- Calendar token (service_role only)
-- ---------------------------------------------------------------------------

-- Upsert connection + refresh token (repo.saveCalendarConnection).
create function public.save_calendar_connection(
  target_space uuid, email text, calendar text, token text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  existing uuid;
begin
  select c.token_id into existing from public.calendar_connections c where c.space_id = target_space for update;
  if existing is null then
    existing := vault.create_secret(token, 'google-calendar:' || target_space);
  else
    perform vault.update_secret(existing, token);
  end if;
  insert into public.calendar_connections (space_id, account_email, calendar_id, token_id, connected_at)
  values (target_space, email, calendar, existing, now())
  on conflict (space_id) do update
    set account_email = excluded.account_email, calendar_id = excluded.calendar_id,
        token_id = excluded.token_id, connected_at = excluded.connected_at;
end;
$$;

create function public.calendar_token(target_space uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from public.calendar_connections c
  join vault.decrypted_secrets s on s.id = c.token_id
  where c.space_id = target_space;
$$;

-- Disconnect removes the token from Vault too.
create function public.calendar_connection_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.token_id is not null then
    delete from vault.secrets where id = old.token_id;
  end if;
  return old;
end;
$$;
create trigger calendar_connections_cleanup after delete on public.calendar_connections
  for each row execute function public.calendar_connection_cleanup();

revoke execute on function public.save_calendar_connection(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.calendar_token(uuid) from public, anon, authenticated;
revoke execute on function public.set_session_event(uuid, text) from public, anon, authenticated;
grant execute on function public.save_calendar_connection(uuid, text, text, text) to service_role;
grant execute on function public.calendar_token(uuid) to service_role;
grant execute on function public.set_session_event(uuid, text) to service_role;
revoke execute on function public.book_coaching_session(uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.change_coaching_session(uuid, timestamptz) from public, anon;
grant execute on function public.book_coaching_session(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.change_coaching_session(uuid, timestamptz) to authenticated;
