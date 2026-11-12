-- Launch 6 item 3: channel moderators + reports queue (G12, G15).
-- Channel moderators: trusted students staff pick per channel. They hide/delete posts and
-- comments and delete chat lines in that channel only. Read-only channels stay staff-only.
-- Reports: a member reports a post, a comment on a post, or a channel chat line once.
-- Moderators of the channel see the queue; staff (community.moderate) also see who reported.
-- Mirrors src/features/community/api/access.ts (channelRule) and api/reports.ts.

create table public.channel_moderators (
  channel_id uuid not null references public.channels (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (channel_id, profile_id)
);
create index channel_moderators_profile on public.channel_moderators (profile_id);

-- ---------------------------------------------------------------------------
-- Helpers. One rule: staff with community.moderate, or a picked moderator who reads the channel.
-- ---------------------------------------------------------------------------

create function public.is_channel_moderator(target_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channel_moderators cm where cm.channel_id = target_channel and cm.profile_id = auth.uid()
  ) and public.can_read_channel(target_channel);
$$;

create function public.can_moderate_channel(target_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_moderate_posts(public.channel_community(target_channel))
    or public.is_channel_moderator(target_channel);
$$;

create function public.post_channel(target_post uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.channel_id from public.posts p where p.id = target_post;
$$;

-- Same body as 20261110090700, hidden posts now also for channel moderators.
create or replace function public.can_read_post(target_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_channel(p.channel_id)
      and (p.hidden_at is null or public.can_moderate_channel(p.channel_id))
    from public.posts p where p.id = target_post
  ), false);
$$;

-- Post comments: comment moderators of the community, or moderators of the post's channel.
create or replace function public.can_moderate_comment_target(t_type text, t_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case t_type
    when 'post' then public.can_moderate_comments(public.post_community(t_id))
      or public.is_channel_moderator(public.post_channel(t_id))
    when 'step' then public.has_capability(public.step_space(t_id), 'comments.moderate')
    else false
  end;
$$;

drop policy posts_update on public.posts;
drop policy posts_delete on public.posts;
create policy posts_update on public.posts for update
  using (public.can_moderate_channel(channel_id))
  with check (public.can_moderate_channel(channel_id));
create policy posts_delete on public.posts for delete
  using (author_id = auth.uid() or public.can_moderate_channel(channel_id));

-- Channel lines: author or channel moderator. DM lines: author only.
drop policy messages_delete on public.messages;
create policy messages_delete on public.messages for delete
  using (author_id = auth.uid() or (channel_id is not null and public.can_moderate_channel(channel_id)));

alter table public.channel_moderators enable row level security;
-- Staff of the community see all; a moderator sees own rows.
create policy channel_moderators_read on public.channel_moderators for select
  using (profile_id = auth.uid() or public.reaches_community(public.channel_community(channel_id)));
-- Picked by staff with community.moderate, from the community's members.
create policy channel_moderators_write on public.channel_moderators for all
  using (public.can_moderate_posts(public.channel_community(channel_id)))
  with check (
    public.can_moderate_posts(public.channel_community(channel_id))
    and public.is_community_member(public.channel_community(channel_id), profile_id)
  );

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Set by the reports_target trigger from the target, never by the caller.
  community_id uuid not null references public.products (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  target_type text not null constraint reports_target check (target_type in ('post', 'comment', 'message')),
  -- Polymorphic: no FK. Removed content keeps its resolved report.
  target_id uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text constraint reports_reason check (reason is null or length(trim(reason)) between 1 and 500),
  status text not null default 'open' constraint reports_status check (status in ('open', 'dismissed', 'removed')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  constraint reports_resolved check ((status = 'open') = (resolved_at is null)),
  constraint reports_once unique (reporter_id, target_type, target_id)
);
create index reports_queue on public.reports (community_id, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);

-- Channel of a reportable target: posts, comments on posts, channel chat lines. Null otherwise.
create function public.report_target_channel(t_type text, t_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case t_type
    when 'post' then public.post_channel(t_id)
    when 'comment' then (
      select public.post_channel(c.target_id) from public.comments c where c.id = t_id and c.target_type = 'post')
    when 'message' then (select m.channel_id from public.messages m where m.id = t_id)
  end;
$$;

create function public.can_read_report_target(t_type text, t_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(case t_type
    when 'post' then public.can_read_post(t_id)
    when 'comment' then public.can_read_comment(t_id) and public.report_target_channel(t_type, t_id) is not null
    when 'message' then (
      select public.can_read_channel(m.channel_id) from public.messages m where m.id = t_id and m.channel_id is not null)
  end, false);
$$;

create function public.reports_target() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.channel_id := public.report_target_channel(new.target_type, new.target_id);
  if new.channel_id is null then
    raise exception 'new row for relation "reports" violates constraint "reports_target_missing"' using errcode = '23503';
  end if;
  new.community_id := public.channel_community(new.channel_id);
  return new;
end;
$$;
create trigger reports_target before insert on public.reports
  for each row execute function public.reports_target();

alter table public.reports enable row level security;
-- Report what you can read, as yourself, open.
create policy reports_insert on public.reports for insert
  with check (
    reporter_id = auth.uid() and status = 'open' and resolved_by is null and resolved_at is null
    and public.can_read_report_target(target_type, target_id)
  );
create policy reports_read on public.reports for select using (public.can_moderate_channel(channel_id));
-- Moderators resolve open reports, signed as themselves. No deletes: resolved reports stay.
create policy reports_update on public.reports for update
  using (status = 'open' and public.can_moderate_channel(channel_id))
  with check (status <> 'open' and resolved_by = auth.uid() and public.can_moderate_channel(channel_id));

-- Reporter hidden from students (channel moderators too): no column privilege on reporter_id.
revoke all on public.reports from anon, authenticated;
grant select (id, community_id, channel_id, target_type, target_id, reason, status, created_at, resolved_by, resolved_at)
  on public.reports to authenticated;
grant insert (target_type, target_id, reporter_id, reason, created_at) on public.reports to authenticated;
grant update (status, resolved_by, resolved_at) on public.reports to authenticated;

-- Who reported what: staff with community.moderate only.
create function public.report_reporters(target_community uuid)
returns table (report_id uuid, reporter_id uuid)
language sql stable security definer set search_path = '' as $$
  select r.id, r.reporter_id from public.reports r
  where r.community_id = target_community and public.can_moderate_posts(target_community);
$$;
revoke execute on function public.report_reporters(uuid) from public, anon;
grant execute on function public.report_reporters(uuid) to authenticated;
