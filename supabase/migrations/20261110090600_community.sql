-- Community core (G12, G13, G15), Launch 1 = feed channels. A community is a product
-- (kind 'community'); members are its grant holders. Owner/admin reach every community, other
-- staff only the ones they are ticked for (space_member_communities). Comments are polymorphic
-- (post | step) so lessons get comments too. Mirrors src/lib/data/types.ts and
-- src/lib/data/fake/fakeCommunityRepo.ts; sqlMirror.test.ts keeps enum lists equal.
-- App-level rules not repeated here: a community keeps at least one channel (studio refuses
-- deleting the last); a new community gets a 'General' channel.

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.products (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  visibility text not null default 'public' constraint channels_visibility check (visibility in ('public', 'read_only')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index channels_community on public.channels (community_id, position);

create table public.space_member_communities (
  community_id uuid not null references public.products (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (community_id, profile_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);
create index posts_channel on public.posts (channel_id, pinned desc, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  target_type text not null constraint comments_target check (target_type in ('post', 'step')),
  -- Polymorphic: no FK. Delete triggers on posts/steps remove orphans.
  target_id uuid not null,
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);
create index comments_target on public.comments (target_type, target_id, created_at);

create table public.reactions (
  target_type text not null constraint reactions_target check (target_type in ('post', 'comment')),
  target_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null constraint reactions_emoji check (emoji in ('👍', '❤️', '😂', '🙏', '🔥', '👏')),
  created_at timestamptz not null default now(),
  primary key (target_type, target_id, profile_id, emoji)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null constraint notifications_type check (type in ('comment', 'reply', 'step_comment', 'mention', 'reaction')),
  post_id uuid references public.posts (id) on delete cascade,
  step_id uuid references public.steps (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id),
  check (num_nonnulls(post_id, step_id) <= 1)
);
create index notifications_recipient on public.notifications (space_id, recipient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Channels hang off community products only.
create function public.channels_community_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select p.kind from public.products p where p.id = new.community_id) is distinct from 'community' then
    raise exception 'channel needs a community product' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger channels_community_kind before insert or update on public.channels
  for each row execute function public.channels_community_kind();

-- One reply level (Kajabi): parent is a top-level comment on the same target.
create function public.comments_parent_shape() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments c
    where c.id = new.parent_id and c.parent_id is null
      and c.target_type = new.target_type and c.target_id = new.target_id
  ) then
    raise exception 'reply must answer a top-level comment on the same target' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger comments_parent_shape before insert or update on public.comments
  for each row execute function public.comments_parent_shape();

-- Polymorphic targets have no FK: clean up comments + reactions when their target goes.
create function public.posts_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.reactions r where r.target_type = 'comment'
    and r.target_id in (select c.id from public.comments c where c.target_type = 'post' and c.target_id = old.id);
  delete from public.comments c where c.target_type = 'post' and c.target_id = old.id;
  delete from public.reactions r where r.target_type = 'post' and r.target_id = old.id;
  return old;
end;
$$;
create trigger posts_cleanup after delete on public.posts
  for each row execute function public.posts_cleanup();

create function public.steps_comment_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.reactions r where r.target_type = 'comment'
    and r.target_id in (select c.id from public.comments c where c.target_type = 'step' and c.target_id = old.id);
  delete from public.comments c where c.target_type = 'step' and c.target_id = old.id;
  return old;
end;
$$;
create trigger steps_comment_cleanup after delete on public.steps
  for each row execute function public.steps_comment_cleanup();

create function public.comments_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.reactions r where r.target_type = 'comment' and r.target_id = old.id;
  return old;
end;
$$;
create trigger comments_cleanup after delete on public.comments
  for each row execute function public.comments_cleanup();

-- ---------------------------------------------------------------------------
-- Helpers (mirror src/features/community/api/access.ts)
-- ---------------------------------------------------------------------------

-- Staff reach: ALWAYS_REACH roles everywhere, other staff only when ticked.
create function public.reaches_community(target_community uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p
    join public.space_members m on m.space_id = p.space_id and m.profile_id = auth.uid()
    where p.id = target_community and p.kind = 'community'
      and (m.role = any (array['owner', 'admin']) or exists (
        select 1 from public.space_member_communities t
        where t.community_id = p.id and t.profile_id = auth.uid()))
  );
$$;

create function public.can_read_community(target_community uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.reaches_community(target_community) or exists (
    select 1 from public.products p
    where p.id = target_community and p.kind = 'community' and p.status = 'published'
      and public.has_grant(p.id)
  );
$$;

create function public.can_moderate_posts(target_community uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.reaches_community(target_community)
    and public.has_capability(public.product_space(target_community), 'community.moderate');
$$;

create function public.can_moderate_comments(target_community uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.reaches_community(target_community)
    and public.has_capability(public.product_space(target_community), 'comments.moderate');
$$;

create function public.channel_community(target_channel uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.community_id from public.channels c where c.id = target_channel;
$$;

create function public.post_community(target_post uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.community_id from public.posts p join public.channels c on c.id = p.channel_id where p.id = target_post;
$$;

-- read_only channels: only post moderators post.
create function public.can_post_in(target_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_community(c.community_id)
      and (c.visibility = 'public' or public.can_moderate_posts(c.community_id))
    from public.channels c where c.id = target_channel
  ), false);
$$;

-- Hidden posts: moderators only.
create function public.can_read_post(target_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_community(public.post_community(p.id))
      and (p.hidden_at is null or public.can_moderate_posts(public.post_community(p.id)))
    from public.posts p where p.id = target_post
  ), false);
$$;

-- step_space(step) comes from the programs migration.

create function public.can_read_comment_target(t_type text, t_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case t_type
    when 'post' then public.can_read_post(t_id)
    when 'step' then public.can_read_step(t_id)
    else false
  end;
$$;

create function public.can_moderate_comment_target(t_type text, t_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case t_type
    when 'post' then public.can_moderate_comments(public.post_community(t_id))
    when 'step' then public.has_capability(public.step_space(t_id), 'comments.moderate')
    else false
  end;
$$;

create function public.comment_target_space(t_type text, t_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case t_type
    when 'post' then public.product_space(public.post_community(t_id))
    when 'step' then public.step_space(t_id)
  end;
$$;

create function public.can_read_comment(target_comment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_comment_target(c.target_type, c.target_id)
      and (c.hidden_at is null or public.can_moderate_comment_target(c.target_type, c.target_id))
    from public.comments c where c.id = target_comment
  ), false);
$$;

-- Directory membership, readable inside policies whatever the caller may see.
create function public.has_space_profile(target_space uuid, target_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.space_profiles sp where sp.space_id = target_space and sp.profile_id = target_profile);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.channels enable row level security;
alter table public.space_member_communities enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.notifications enable row level security;

create policy channels_read on public.channels for select
  using (public.can_read_community(community_id));
create policy channels_write on public.channels for all
  using (public.reaches_community(community_id) and public.has_capability(public.product_space(community_id), 'products.edit'))
  with check (public.reaches_community(community_id) and public.has_capability(public.product_space(community_id), 'products.edit'));

-- Ticks: readable by staff of the space, written with staff.manage only (G15).
create policy smc_read on public.space_member_communities for select
  using (public.is_space_staff(public.product_space(community_id)));
create policy smc_write on public.space_member_communities for all
  using (public.has_capability(public.product_space(community_id), 'staff.manage'))
  with check (public.has_capability(public.product_space(community_id), 'staff.manage'));

create policy posts_read on public.posts for select using (public.can_read_post(id));
create policy posts_insert on public.posts for insert
  with check (author_id = auth.uid() and pinned = false and hidden_at is null and public.can_post_in(channel_id));
-- Moderators pin/hide; nobody edits bodies in v1.
create policy posts_update on public.posts for update
  using (public.can_moderate_posts(public.channel_community(channel_id)))
  with check (public.can_moderate_posts(public.channel_community(channel_id)));
create policy posts_delete on public.posts for delete
  using (author_id = auth.uid() or public.can_moderate_posts(public.channel_community(channel_id)));

create policy comments_read on public.comments for select using (public.can_read_comment(id));
create policy comments_insert on public.comments for insert
  with check (
    author_id = auth.uid() and hidden_at is null
    and public.can_read_comment_target(target_type, target_id)
    and space_id = public.comment_target_space(target_type, target_id)
  );
create policy comments_update on public.comments for update
  using (public.can_moderate_comment_target(target_type, target_id))
  with check (public.can_moderate_comment_target(target_type, target_id));
create policy comments_delete on public.comments for delete
  using (author_id = auth.uid() or public.can_moderate_comment_target(target_type, target_id));

create policy reactions_read on public.reactions for select
  using (case target_type when 'post' then public.can_read_post(target_id) else public.can_read_comment(target_id) end);
create policy reactions_insert on public.reactions for insert
  with check (
    profile_id = auth.uid()
    and case target_type when 'post' then public.can_read_post(target_id) else public.can_read_comment(target_id) end
  );
create policy reactions_delete on public.reactions for delete using (profile_id = auth.uid());

-- Recipients read + mark read. Actors insert rows they cause; recipients must be in the space.
create policy notifications_read on public.notifications for select using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_insert on public.notifications for insert
  with check (
    actor_id = auth.uid() and read_at is null
    and public.has_space_profile(space_id, recipient_id)
  );
