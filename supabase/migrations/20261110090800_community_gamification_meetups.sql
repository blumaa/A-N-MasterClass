-- Launch 3: points + leaderboard, challenges, meetups (G12, G14).
-- Additive on top of 20261110090700_community_groups_chat_dms.sql. Mirrors src/lib/data/types.ts,
-- src/lib/data/fake/{fakePoints,fakeEventsRepo}.ts and src/features/community/api/{points,
-- challenges,meetups}.ts; sqlMirror.test.ts keeps enum lists and limits equal.
-- Kajabi: https://help.kajabi.com/articles/products/community/community-settings-gamification
-- - points per action (comment on a post, reaction given/received, DM, challenge entry);
--   values editable 0..1000, 0 = nothing; fixed when earned (no retroactive change);
-- - ledger rows go away with their source, so totals never go negative;
-- - leaderboard shown to members, staff only, or off; members also need it in their group;
-- - challenge entries: one per member, inside the window, visible to the author and staff;
-- - meetup join link: staff always, members from 15 minutes before the start until the end.

-- ---------------------------------------------------------------------------
-- Settings + group toggles
-- ---------------------------------------------------------------------------

alter table public.access_groups
  add column challenges boolean not null default true,
  add column meetups boolean not null default true,
  add column leaderboard boolean not null default true;

-- Overrides of DEFAULT_POINT_VALUES: known reasons only, whole numbers 0..1000.
create function public.is_point_values(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object' and not exists (
    select 1 from jsonb_each(v) e
    where e.key not in ('comment', 'reaction_given', 'reaction_received', 'dm', 'challenge')
      or jsonb_typeof(e.value) <> 'number'
      or (e.value)::numeric <> trunc((e.value)::numeric)
      or (e.value)::numeric not between 0 and 1000
  );
$$;

alter table public.community_settings
  add column points_enabled boolean not null default true,
  add column leaderboard text not null default 'members'
    constraint community_settings_leaderboard check (leaderboard in ('members', 'staff', 'off')),
  add column point_values jsonb not null default '{}'::jsonb
    constraint community_settings_point_values check (public.is_point_values(point_values));

-- Kajabi defaults; a settings override wins.
create function public.point_value(target_community uuid, reason text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (s.point_values ->> reason)::integer from public.community_settings s where s.community_id = target_community),
    case reason
      when 'comment' then 3 when 'reaction_given' then 1 when 'reaction_received' then 1
      when 'dm' then 1 when 'challenge' then 100 end
  );
$$;

-- Group toggles: staff always, members by union over their groups.
create or replace function public.community_feature(target_community uuid, feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.reaches_community(target_community) or exists (
    select 1 from public.access_groups ag
    where ag.id in (select public.member_groups(target_community))
      and case feature
        when 'directory' then ag.directory when 'dms' then ag.dms
        when 'challenges' then ag.challenges when 'meetups' then ag.meetups
        when 'leaderboard' then ag.leaderboard else false end
  );
$$;

-- Staff, or a member holding that group (reachesGroup in access.ts).
create function public.reaches_group(target_community uuid, target_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.reaches_community(target_community)
    or target_group in (select public.member_groups(target_community));
$$;

-- Event rows: group of the same community, channel of the same community.
create function public.event_matches_community() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select g.community_id from public.access_groups g where g.id = new.access_group_id) is distinct from new.community_id then
    raise exception 'access group must belong to the community' using errcode = '23514';
  end if;
  if tg_table_name = 'meetups' then
    if new.channel_id is not null and public.channel_community(new.channel_id) is distinct from new.community_id then
      raise exception 'channel must belong to the community' using errcode = '23514';
    end if;
    if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone) then
      raise exception 'unknown time zone' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Points ledger
-- ---------------------------------------------------------------------------

create table public.points_ledger (
  community_id uuid not null references public.products (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null
    constraint points_ledger_reason check (reason in ('comment', 'reaction_given', 'reaction_received', 'dm', 'challenge')),
  -- comment id | post id | post id:reactor id | message id | challenge id (see fakePoints.ts).
  source_key text not null,
  points integer not null constraint points_ledger_points check (points between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key (reason, source_key, profile_id)
);
create index points_ledger_totals on public.points_ledger (community_id, created_at);

-- Award once per (reason, source, profile); nothing while points are off or the value is 0.
create function public.award_points(target_community uuid, target_profile uuid, reason text, source_key text, at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  value integer := public.point_value(target_community, reason);
begin
  if target_community is null or value is null or value <= 0
     or not coalesce((select s.points_enabled from public.community_settings s where s.community_id = target_community), true) then
    return;
  end if;
  insert into public.points_ledger (community_id, profile_id, reason, source_key, points, created_at)
  values (target_community, target_profile, reason, source_key, value, at)
  on conflict do nothing;
end;
$$;
revoke execute on function public.award_points(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;

create function public.points_on_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type = 'post' then
      perform public.award_points(public.post_community(new.target_id), new.author_id, 'comment', new.id::text, new.created_at);
    end if;
    return new;
  end if;
  delete from public.points_ledger l where l.reason = 'comment' and l.source_key = old.id::text;
  return old;
end;
$$;
create trigger comments_points after insert or delete on public.comments
  for each row execute function public.points_on_comment();

-- First reaction of a member on someone else's post: given to the reactor, received to the author.
-- The rows go once the member has no reaction left on that post.
create function public.points_on_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  post_author uuid;
begin
  if tg_op = 'INSERT' then
    if new.target_type = 'post' then
      select p.author_id into post_author from public.posts p where p.id = new.target_id;
      if post_author is not null and post_author <> new.profile_id then
        perform public.award_points(public.post_community(new.target_id), new.profile_id, 'reaction_given',
          new.target_id::text, new.created_at);
        perform public.award_points(public.post_community(new.target_id), post_author, 'reaction_received',
          new.target_id::text || ':' || new.profile_id::text, new.created_at);
      end if;
    end if;
    return new;
  end if;
  if old.target_type = 'post' and not exists (
    select 1 from public.reactions r
    where r.target_type = 'post' and r.target_id = old.target_id and r.profile_id = old.profile_id
  ) then
    delete from public.points_ledger l
    where (l.reason = 'reaction_given' and l.source_key = old.target_id::text and l.profile_id = old.profile_id)
       or (l.reason = 'reaction_received' and l.source_key = old.target_id::text || ':' || old.profile_id::text);
  end if;
  return old;
end;
$$;
create trigger reactions_points after insert or delete on public.reactions
  for each row execute function public.points_on_reaction();

-- DMs only (thread lines); chat channel lines earn nothing.
create function public.points_on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.thread_id is not null then
      perform public.award_points((select t.community_id from public.dm_threads t where t.id = new.thread_id),
        new.author_id, 'dm', new.id::text, new.created_at);
    end if;
    return new;
  end if;
  delete from public.points_ledger l where l.reason = 'dm' and l.source_key = old.id::text;
  return old;
end;
$$;
create trigger messages_points after insert or delete on public.messages
  for each row execute function public.points_on_message();

-- Leaderboard visibility (seesLeaderboard in points.ts).
create function public.sees_leaderboard(target_community uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(s.points_enabled, true)
    and coalesce(s.leaderboard, 'members') <> 'off'
    and public.can_read_community(target_community)
    and (public.reaches_community(target_community)
         or (coalesce(s.leaderboard, 'members') = 'members' and public.community_feature(target_community, 'leaderboard')))
  from (select 1) one
  left join public.community_settings s on s.community_id = target_community;
$$;

-- Totals since a period start (null = all time), highest first; empty when the board is hidden.
create function public.point_totals(target_community uuid, since timestamptz)
returns table (profile_id uuid, points bigint)
language sql stable security definer set search_path = '' as $$
  select l.profile_id, sum(l.points)
  from public.points_ledger l
  where public.sees_leaderboard(target_community)
    and l.community_id = target_community and (since is null or l.created_at >= since)
  group by l.profile_id
  having sum(l.points) > 0
  order by sum(l.points) desc, l.profile_id;
$$;

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.products (id) on delete cascade,
  access_group_id uuid not null references public.access_groups (id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text not null default '' constraint challenges_description check (length(description) <= 10000),
  prize text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  show_before_start boolean not null default false,
  created_at timestamptz not null default now(),
  constraint challenges_window check (ends_at > starts_at)
);
create index challenges_community on public.challenges (community_id, starts_at desc);
create trigger challenges_matches_community before insert or update on public.challenges
  for each row execute function public.event_matches_community();

create table public.challenge_entries (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null constraint challenge_entries_body check (length(trim(body)) > 0 and length(body) <= 5000),
  created_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);

-- Entries only inside the window (also for staff and the service role).
create function public.challenge_entries_window() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.challenges c
    where c.id = new.challenge_id and new.created_at between c.starts_at and c.ends_at
  ) then
    raise exception 'entry outside the challenge window' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger challenge_entries_window before insert or update on public.challenge_entries
  for each row execute function public.challenge_entries_window();

create function public.points_on_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.award_points((select c.community_id from public.challenges c where c.id = new.challenge_id),
      new.profile_id, 'challenge', new.challenge_id::text, new.created_at);
    return new;
  end if;
  delete from public.points_ledger l
  where l.reason = 'challenge' and l.source_key = old.challenge_id::text and l.profile_id = old.profile_id;
  return old;
end;
$$;
create trigger challenge_entries_points after insert or delete on public.challenge_entries
  for each row execute function public.points_on_entry();

-- challengeVisible: feature on, group reached, started or teased (staff: always).
create function public.can_read_challenge(target_challenge uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_community(c.community_id)
      and public.community_feature(c.community_id, 'challenges')
      and public.reaches_group(c.community_id, c.access_group_id)
      and (public.reaches_community(c.community_id) or c.show_before_start or c.starts_at <= now())
    from public.challenges c where c.id = target_challenge
  ), false);
$$;

create function public.challenge_open(target_challenge uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenges c where c.id = target_challenge and now() between c.starts_at and c.ends_at);
$$;

-- Members see the count, not the other entries.
create function public.challenge_entry_count(target_challenge uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when public.can_read_challenge(target_challenge)
    then (select count(*)::integer from public.challenge_entries e where e.challenge_id = target_challenge) end;
$$;

-- ---------------------------------------------------------------------------
-- Meetups
-- ---------------------------------------------------------------------------

create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.products (id) on delete cascade,
  access_group_id uuid not null references public.access_groups (id) on delete restrict,
  channel_id uuid references public.channels (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text not null default '' constraint meetups_description check (length(description) <= 10000),
  location text not null constraint meetups_location check (location ~ '^https://\S+$'),
  time_zone text not null default 'UTC',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  replay_vimeo_id text constraint meetups_replay check (replay_vimeo_id ~ '^[0-9]+$'),
  created_at timestamptz not null default now(),
  constraint meetups_window check (ends_at > starts_at)
);
create index meetups_community on public.meetups (community_id, starts_at);
create trigger meetups_matches_community before insert or update on public.meetups
  for each row execute function public.event_matches_community();

create table public.meetup_rsvps (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, profile_id)
);

create function public.can_read_meetup(target_meetup uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_community(m.community_id)
      and public.community_feature(m.community_id, 'meetups')
      and public.reaches_group(m.community_id, m.access_group_id)
    from public.meetups m where m.id = target_meetup
  ), false);
$$;

-- Join link: staff always; members from 15 minutes before the start until the end (JOIN_OPENS_MINUTES).
-- meetups.location is not selectable by clients; this is the only way to read it.
create function public.meetup_join_url(target_meetup uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.location from public.meetups m
  where m.id = target_meetup and public.can_read_meetup(m.id)
    and (public.reaches_community(m.community_id)
         or now() between m.starts_at - interval '15 minutes' and m.ends_at);
$$;

create function public.meetup_rsvp_count(target_meetup uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when public.can_read_meetup(target_meetup)
    then (select count(*)::integer from public.meetup_rsvps r where r.meetup_id = target_meetup) end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + column grants
-- ---------------------------------------------------------------------------

alter table public.points_ledger enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_rsvps enable row level security;

-- Ledger: own rows, or the whole board where it is shown. Written by triggers only.
create policy points_ledger_read on public.points_ledger for select
  using (profile_id = auth.uid() or public.sees_leaderboard(community_id));

create policy challenges_read on public.challenges for select using (public.can_read_challenge(id));
create policy challenges_write on public.challenges for all
  using (public.can_edit_community(community_id))
  with check (public.can_edit_community(community_id));

-- Entries: author and staff read; author enters and withdraws while open.
create policy challenge_entries_read on public.challenge_entries for select
  using (profile_id = auth.uid() or public.reaches_community((select c.community_id from public.challenges c where c.id = challenge_id)));
create policy challenge_entries_insert on public.challenge_entries for insert
  with check (profile_id = auth.uid() and public.can_read_challenge(challenge_id) and public.challenge_open(challenge_id));
create policy challenge_entries_delete on public.challenge_entries for delete
  using (profile_id = auth.uid() and public.challenge_open(challenge_id));

create policy meetups_read on public.meetups for select using (public.can_read_meetup(id));
create policy meetups_write on public.meetups for all
  using (public.can_edit_community(community_id))
  with check (public.can_edit_community(community_id));

-- Hide the join link column; staff and members read it through meetup_join_url().
revoke select on public.meetups from anon, authenticated;
grant select (id, community_id, access_group_id, channel_id, title, description, time_zone,
  starts_at, ends_at, replay_vimeo_id, created_at) on public.meetups to anon, authenticated;

-- RSVPs: own rows and staff; RSVP until the meetup ends.
create policy meetup_rsvps_read on public.meetup_rsvps for select
  using (profile_id = auth.uid() or public.reaches_community((select m.community_id from public.meetups m where m.id = meetup_id)));
create policy meetup_rsvps_insert on public.meetup_rsvps for insert
  with check (
    profile_id = auth.uid() and public.can_read_meetup(meetup_id)
    and exists (select 1 from public.meetups m where m.id = meetup_id and now() <= m.ends_at)
  );
create policy meetup_rsvps_delete on public.meetup_rsvps for delete using (profile_id = auth.uid());
