-- Launch 6 item 3 follow-up (G15): post approval, post lock, review tabs, moderation log,
-- report notifications. Mirrors src/features/community/api/visibility.ts, review.ts, reports.ts.

-- ---------------------------------------------------------------------------
-- Posts: status (approval) + lock
-- ---------------------------------------------------------------------------

alter table public.posts
  add column locked_at timestamptz,
  add column status text not null default 'published'
    constraint posts_status check (status in ('published', 'pending', 'rejected'));
create index posts_review on public.posts (channel_id, status) where status <> 'published';

-- Members whose posts wait for approval, per community. Set by staff with community.moderate.
create table public.post_approval_members (
  community_id uuid not null references public.products (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (community_id, profile_id)
);
create index post_approval_members_profile on public.post_approval_members (profile_id);

alter table public.post_approval_members enable row level security;
create policy post_approval_members_read on public.post_approval_members for select
  using (profile_id = auth.uid() or public.reaches_community(community_id));
create policy post_approval_members_write on public.post_approval_members for all
  using (public.can_moderate_posts(community_id))
  with check (public.can_moderate_posts(community_id) and public.is_community_member(community_id, profile_id));

-- New posts: pending when the author is on the approval list, else published. Caller cannot choose.
create function public.posts_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := case when exists (
    select 1 from public.post_approval_members a
    where a.community_id = public.channel_community(new.channel_id) and a.profile_id = new.author_id
  ) then 'pending' else 'published' end;
  return new;
end;
$$;
create trigger posts_status before insert on public.posts
  for each row execute function public.posts_status();

-- Same body as 20261112090000, plus: pending/rejected posts for moderators and the author only.
create or replace function public.can_read_post(target_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_channel(p.channel_id)
      and (public.can_moderate_channel(p.channel_id)
        or (p.hidden_at is null and (p.status = 'published' or p.author_id = auth.uid())))
    from public.posts p where p.id = target_post
  ), false);
$$;

-- Open for comments: published and not locked.
create function public.post_open(target_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.locked_at is null and p.status = 'published' from public.posts p where p.id = target_post), false);
$$;

drop policy posts_insert on public.posts;
create policy posts_insert on public.posts for insert
  with check (author_id = auth.uid() and pinned = false and hidden_at is null and locked_at is null
    and public.can_post_in(channel_id));

drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (
    author_id = auth.uid() and hidden_at is null
    and public.can_read_comment_target(target_type, target_id)
    and (target_type <> 'post' or public.post_open(target_id))
    and space_id = public.comment_target_space(target_type, target_id)
  );

-- ---------------------------------------------------------------------------
-- Reports: resolve by hiding
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_status;
alter table public.reports add constraint reports_status check (status in ('open', 'dismissed', 'removed', 'hidden'));

-- ---------------------------------------------------------------------------
-- Report notifications: to everyone who moderates the channel (can_moderate_channel).
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_type;
alter table public.notifications add constraint notifications_type check (type in ('comment', 'reply', 'step_comment', 'mention', 'reaction', 'report'));
alter table public.notifications
  add column community_id uuid references public.products (id) on delete cascade,
  add constraint notifications_report check ((type = 'report') = (community_id is not null));

-- The caller filed a report in this community.
create function public.reported_in(target_community uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.community_id = target_community and r.reporter_id = auth.uid());
$$;

drop policy notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert
  with check (
    actor_id = auth.uid() and read_at is null
    and public.has_space_profile(space_id, recipient_id)
    and (type <> 'report' or public.reported_in(community_id))
  );

-- ---------------------------------------------------------------------------
-- Moderation log: hide, unhide, lock, unlock, approve, reject. Append only.
-- ---------------------------------------------------------------------------

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  -- Set by the moderation_log_target trigger from the target, never by the caller.
  community_id uuid not null references public.products (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null constraint moderation_log_action check (action in ('hide', 'unhide', 'lock', 'unlock', 'approve', 'reject')),
  target_type text not null constraint moderation_log_target check (target_type in ('post', 'comment')),
  -- Polymorphic: no FK. Deleted content keeps its log rows.
  target_id uuid not null,
  created_at timestamptz not null default now()
);
create index moderation_log_feed on public.moderation_log (community_id, created_at desc);

create function public.moderation_log_target() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.channel_id := public.report_target_channel(new.target_type, new.target_id);
  if new.channel_id is null then
    raise exception 'new row for relation "moderation_log" violates constraint "moderation_log_target_missing"'
      using errcode = '23503';
  end if;
  new.community_id := public.channel_community(new.channel_id);
  return new;
end;
$$;
create trigger moderation_log_target before insert on public.moderation_log
  for each row execute function public.moderation_log_target();

-- Who may moderate the target: posts = channel moderators; comments = comment moderators of the post.
create function public.can_moderate_log_target(t_type text, t_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(case t_type
    when 'post' then public.can_moderate_channel(public.post_channel(t_id))
    when 'comment' then (
      select public.can_moderate_comment_target('post', c.target_id) from public.comments c
      where c.id = t_id and c.target_type = 'post')
  end, false);
$$;

alter table public.moderation_log enable row level security;
create policy moderation_log_read on public.moderation_log for select
  using (public.can_moderate_channel(channel_id) or public.can_moderate_comments(community_id));
create policy moderation_log_insert on public.moderation_log for insert
  with check (actor_id = auth.uid() and public.can_moderate_log_target(target_type, target_id));

revoke all on public.moderation_log from anon, authenticated;
grant select on public.moderation_log to authenticated;
grant insert (actor_id, action, target_type, target_id, created_at) on public.moderation_log to authenticated;
