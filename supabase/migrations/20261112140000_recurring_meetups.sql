-- Launch 6 item 8: recurring meetups (G14, Kajabi "Repeat").
-- A series stores its first occurrence plus repeat rules; occurrence n is computed by
-- meetup_occurrence_start (TS mirror: src/lib/calendar/recurrence.ts), never stored.
-- meetup_occurrences holds "this event only" edits and cancels. RSVPs are per occurrence.
-- Repeats step in the meetup's zone and keep its wall-clock time across DST.

alter table public.meetups
  add column repeat_freq text constraint meetups_repeat_freq check (repeat_freq in ('daily', 'weekly', 'monthly')),
  add column repeat_every integer not null default 1,
  add column repeat_days integer[] not null default '{}',
  add column repeat_count integer,
  add column repeat_until date,
  add constraint meetups_repeat check (
    case when repeat_freq is null
      then repeat_every = 1 and repeat_days = '{}' and repeat_count is null and repeat_until is null
      else repeat_every between 1 and 99
        and (repeat_count is null or repeat_until is null)
        and (repeat_count is null or repeat_count between 1 and 999)
        and (repeat_freq = 'weekly' or repeat_days = '{}')
        and repeat_days <@ array[1, 2, 3, 4, 5, 6, 7]
    end
  );

grant select (repeat_freq, repeat_every, repeat_days, repeat_count, repeat_until) on public.meetups to anon, authenticated;

-- Wall-clock time in a zone -> instant. Repeated hour: the earlier instant; skipped hour: moved
-- forward by the gap. Same as zonedToUtc in src/lib/format/zoned.ts.
create function public.zoned_to_utc(local timestamp, zone text) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  later timestamptz := local at time zone zone;
  earlier timestamptz;
begin
  foreach earlier in array array[later - interval '1 hour', later - interval '30 minutes'] loop
    if (earlier at time zone zone) = local then
      return earlier;
    end if;
  end loop;
  return later;
end;
$$;

-- Start of occurrence n of a meetup row; null when the series has no such occurrence.
create function public.meetup_occurrence_start(m public.meetups, n integer) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  ls timestamp := m.starts_at at time zone m.time_zone;
  first date := ls::date;
  own integer := extract(isodow from ls)::integer;
  days integer[];
  k integer;
  ordinal integer;
  month_start date;
  last_day date;
  d date;
begin
  if n is null or n < 0 then return null; end if;
  if n = 0 then return m.starts_at; end if;
  if m.repeat_freq is null or n > 100000 or (m.repeat_count is not null and n >= m.repeat_count) then
    return null;
  end if;
  case m.repeat_freq
    when 'daily' then
      d := first + n * m.repeat_every;
    when 'weekly' then
      days := array(select distinct x from unnest(m.repeat_days || own) x order by x);
      k := array_position(days, own) - 1 + n;
      d := first - (own - 1) + (k / cardinality(days)) * m.repeat_every * 7 + days[k % cardinality(days) + 1] - 1;
    else
      ordinal := (extract(day from first)::integer + 6) / 7;
      month_start := (date_trunc('month', first) + make_interval(months => n * m.repeat_every))::date;
      if ordinal = 5 then
        last_day := (month_start + interval '1 month' - interval '1 day')::date;
        d := last_day - ((extract(isodow from last_day)::integer - own + 7) % 7);
      else
        d := month_start + ((own - extract(isodow from month_start)::integer + 7) % 7) + (ordinal - 1) * 7;
      end if;
  end case;
  if m.repeat_until is not null and d > m.repeat_until then return null; end if;
  return public.zoned_to_utc(d + ls::time, m.time_zone);
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-occurrence edits and cancels
-- ---------------------------------------------------------------------------

create table public.meetup_occurrences (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  occurrence integer not null check (occurrence >= 0),
  cancelled boolean not null default false,
  title text constraint meetup_occurrences_title check (length(trim(title)) > 0),
  description text constraint meetup_occurrences_description check (length(description) <= 10000),
  starts_at timestamptz,
  ends_at timestamptz,
  replay_vimeo_id text constraint meetup_occurrences_replay check (replay_vimeo_id ~ '^[0-9]+$'),
  primary key (meetup_id, occurrence),
  constraint meetup_occurrences_window check ((starts_at is null) = (ends_at is null) and (starts_at is null or ends_at > starts_at))
);

-- Effective window of an occurrence (edit applied); null when missing or cancelled.
create function public.meetup_occurrence_window(target_meetup uuid, target_occurrence integer) returns tstzrange
language sql stable security definer set search_path = '' as $$
  select case when o.cancelled then null else
    tstzrange(coalesce(o.starts_at, s.at), coalesce(o.ends_at, s.at + (m.ends_at - m.starts_at)), '[]') end
  from public.meetups m
  cross join lateral (select public.meetup_occurrence_start(m, target_occurrence) as at) s
  left join public.meetup_occurrences o on o.meetup_id = m.id and o.occurrence = target_occurrence
  where m.id = target_meetup and s.at is not null;
$$;

create function public.meetup_occurrence_exists() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.meetup_occurrence_start((select m from public.meetups m where m.id = new.meetup_id), new.occurrence) is null then
    raise exception 'new row for relation "%" violates constraint "meetup_occurrence_missing"', tg_table_name using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger meetup_occurrences_exists before insert or update on public.meetup_occurrences
  for each row execute function public.meetup_occurrence_exists();

-- Cancelling an occurrence drops its RSVPs (Kajabi: RSVP'd members lose access).
create function public.meetup_occurrence_cancelled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.meetup_rsvps r where r.meetup_id = new.meetup_id and r.occurrence = new.occurrence;
  return null;
end;
$$;
create trigger meetup_occurrences_cancel after insert or update of cancelled on public.meetup_occurrences
  for each row when (new.cancelled) execute function public.meetup_occurrence_cancelled();

-- ---------------------------------------------------------------------------
-- RSVPs per occurrence
-- ---------------------------------------------------------------------------

alter table public.meetup_rsvps add column occurrence integer not null default 0 check (occurrence >= 0);
alter table public.meetup_rsvps drop constraint meetup_rsvps_pkey;
alter table public.meetup_rsvps add primary key (meetup_id, occurrence, profile_id);

-- Shorter series or a moved schedule: drop edits and RSVPs of occurrences that no longer exist.
create function public.meetup_series_trim() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.meetup_occurrences o
    where o.meetup_id = new.id and public.meetup_occurrence_start(new, o.occurrence) is null;
  delete from public.meetup_rsvps r
    where r.meetup_id = new.id and public.meetup_occurrence_start(new, r.occurrence) is null;
  return null;
end;
$$;
create trigger meetups_trim after update of starts_at, time_zone, repeat_freq, repeat_every, repeat_days, repeat_count, repeat_until
  on public.meetups for each row execute function public.meetup_series_trim();

drop policy meetup_rsvps_insert on public.meetup_rsvps;
create policy meetup_rsvps_insert on public.meetup_rsvps for insert
  with check (
    profile_id = auth.uid() and public.can_read_meetup(meetup_id)
    and now() <= upper(public.meetup_occurrence_window(meetup_id, occurrence))
  );

-- Join link and RSVP count per occurrence (0 = first / one-off).
drop function public.meetup_join_url(uuid);
create function public.meetup_join_url(target_meetup uuid, target_occurrence integer default 0) returns text
language sql stable security definer set search_path = '' as $$
  select m.location from public.meetups m
  cross join lateral (select public.meetup_occurrence_window(m.id, target_occurrence) as w) o
  where m.id = target_meetup and public.can_read_meetup(m.id) and o.w is not null
    and (public.reaches_community(m.community_id)
         or now() between lower(o.w) - interval '15 minutes' and upper(o.w));
$$;

drop function public.meetup_rsvp_count(uuid);
create function public.meetup_rsvp_count(target_meetup uuid, target_occurrence integer default 0) returns integer
language sql stable security definer set search_path = '' as $$
  select case when public.can_read_meetup(target_meetup)
    then (select count(*)::integer from public.meetup_rsvps r
          where r.meetup_id = target_meetup and r.occurrence = target_occurrence) end;
$$;

alter table public.meetup_occurrences enable row level security;
create policy meetup_occurrences_read on public.meetup_occurrences for select using (public.can_read_meetup(meetup_id));
create policy meetup_occurrences_write on public.meetup_occurrences for all
  using (public.can_edit_community((select m.community_id from public.meetups m where m.id = meetup_id)))
  with check (public.can_edit_community((select m.community_id from public.meetups m where m.id = meetup_id)));

-- ---------------------------------------------------------------------------
-- "This and following": split a series at an occurrence into a new series
-- ---------------------------------------------------------------------------

-- The new series starts at occurrence `split_at` with the same rules and takes over the edits and
-- RSVPs from there on (renumbered from 0); the old one ends before `split_at`. Returns the new id.
create function public.split_meetup(target_meetup uuid, split_at integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  m public.meetups;
  s timestamptz;
  new_id uuid;
begin
  select * into m from public.meetups where id = target_meetup for update;
  if not found or not public.can_edit_community(m.community_id) then
    raise exception 'meetup not found' using errcode = '42501';
  end if;
  s := public.meetup_occurrence_start(m, split_at);
  if split_at < 1 or s is null then
    raise exception 'new row for relation "meetups" violates constraint "meetup_occurrence_missing"' using errcode = '23514';
  end if;
  insert into public.meetups (community_id, access_group_id, channel_id, title, description, location, time_zone,
    starts_at, ends_at, created_at, repeat_freq, repeat_every, repeat_days, repeat_count, repeat_until)
  values (m.community_id, m.access_group_id, m.channel_id, m.title, m.description, m.location, m.time_zone,
    s, s + (m.ends_at - m.starts_at), now(), m.repeat_freq, m.repeat_every,
    case when m.repeat_freq = 'weekly'
      then array(select distinct x from unnest(m.repeat_days || extract(isodow from m.starts_at at time zone m.time_zone)::integer) x order by x)
      else '{}' end,
    m.repeat_count - split_at, m.repeat_until)
  returning id into new_id;
  update public.meetup_occurrences set meetup_id = new_id, occurrence = occurrence - split_at
    where meetup_id = target_meetup and occurrence >= split_at;
  update public.meetup_rsvps set meetup_id = new_id, occurrence = occurrence - split_at
    where meetup_id = target_meetup and occurrence >= split_at;
  update public.meetups set repeat_count = split_at, repeat_until = null where id = target_meetup;
  return new_id;
end;
$$;
revoke execute on function public.split_meetup(uuid, integer) from public, anon;
grant execute on function public.split_meetup(uuid, integer) to authenticated, service_role;
