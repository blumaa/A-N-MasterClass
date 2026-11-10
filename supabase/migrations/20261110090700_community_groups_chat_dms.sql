-- Launch 2: access groups, chat channels, private channels, DMs, blocks (G12, G13).
-- Additive on top of 20261110090600_community.sql. Mirrors src/lib/data/types.ts,
-- src/lib/data/fake/fakeChatRepo.ts and src/features/community/api/{access,chat}.ts;
-- sqlMirror.test.ts keeps enum lists equal.
-- Kajabi: https://help.kajabi.com/en/articles/17174417-community-access-groups
-- - every community has one default group ('Members'); a grant without a group joins it;
-- - each channel belongs to one group; private channels need an invite inside that group;
-- - groups toggle the member directory and starting DMs;
-- - staff reach every channel; read-only channels: only post moderators post or send.
-- Live updates: the app polls (router.refresh); Supabase Realtime is not used yet.

-- ---------------------------------------------------------------------------
-- Access groups
-- ---------------------------------------------------------------------------

create table public.access_groups (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.products (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  is_default boolean not null default false,
  directory boolean not null default true,
  dms boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index access_groups_one_default on public.access_groups (community_id) where is_default;
create index access_groups_community on public.access_groups (community_id);

create function public.access_groups_community_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select p.kind from public.products p where p.id = new.community_id) is distinct from 'community' then
    raise exception 'access group needs a community product' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger access_groups_community_kind before insert or update on public.access_groups
  for each row execute function public.access_groups_community_kind();

-- The default group stays while its community exists (cascade from products still removes it).
create function public.access_groups_keep_default() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_default and exists (select 1 from public.products p where p.id = old.community_id) then
    raise exception 'the default group cannot be deleted' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger access_groups_keep_default before delete on public.access_groups
  for each row execute function public.access_groups_keep_default();

-- Every community product gets its default group.
create function public.products_default_group() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'community' then
    insert into public.access_groups (community_id, title, is_default) values (new.id, 'Members', true);
  end if;
  return new;
end;
$$;
create trigger products_default_group after insert on public.products
  for each row execute function public.products_default_group();

insert into public.access_groups (community_id, title, is_default)
select p.id, 'Members', true from public.products p
where p.kind = 'community'
  and not exists (select 1 from public.access_groups g where g.community_id = p.id and g.is_default);

create function public.default_group(target_community uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select g.id from public.access_groups g where g.community_id = target_community and g.is_default;
$$;

-- Group of a grant/offer item must belong to that product. In-use groups cannot be deleted (restrict).
create function public.group_matches_product() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.access_group_id is not null
     and (select g.community_id from public.access_groups g where g.id = new.access_group_id) is distinct from new.product_id then
    raise exception 'access group must belong to the granted community' using errcode = '23514';
  end if;
  return new;
end;
$$;

alter table public.grants
  add constraint grants_access_group foreign key (access_group_id) references public.access_groups (id) on delete restrict;
alter table public.offer_products
  add constraint offer_products_access_group foreign key (access_group_id) references public.access_groups (id) on delete restrict;
create trigger grants_group_matches before insert or update on public.grants
  for each row execute function public.group_matches_product();
create trigger offer_products_group_matches before insert or update on public.offer_products
  for each row execute function public.group_matches_product();

-- One active grant per product, profile and group: a member may hold several groups of one community.
drop index public.grants_one_active;
create unique index grants_one_active on public.grants
  (product_id, profile_id, coalesce(access_group_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';

-- Several grants per product now possible: drip counts from the earliest.
create or replace function public.active_grant_at(target_product uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select min(g.granted_at) from public.grants g
  where g.product_id = target_product and g.profile_id = auth.uid() and g.status = 'active'
    and (g.expires_at is null or g.expires_at > now());
$$;

-- fulfil_order: grants carry the offer item's access group.
create or replace function public.fulfil_order(target_order uuid, capture text, buyer uuid, display_name text)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = target_order for update;
  if not found then
    raise exception 'order % not found', target_order using errcode = 'P0002';
  end if;
  if o.status <> 'created' then
    return o;
  end if;
  if capture is null and o.provider <> 'free' then
    raise exception 'order % needs a capture', target_order using errcode = '23514';
  end if;

  insert into public.space_profiles (space_id, profile_id, display_name)
  values (o.space_id, buyer, display_name)
  on conflict (space_id, profile_id) do nothing;

  insert into public.grants (product_id, profile_id, access_group_id, source, order_id)
  select op.product_id, buyer, op.access_group_id, 'purchase', o.id
  from public.offer_products op
  where op.offer_id = o.offer_id
  on conflict (product_id, profile_id, coalesce(access_group_id, '00000000-0000-0000-0000-000000000000'::uuid))
    where status = 'active' do nothing;

  insert into public.contacts (space_id, email, profile_id, marketing_consent, consent_at, consent_source)
  values (
    o.space_id, o.email, buyer, o.marketing_consent,
    case when o.marketing_consent then o.created_at end,
    case when o.marketing_consent then 'checkout' end
  )
  on conflict (space_id, email) do update set
    profile_id = excluded.profile_id,
    marketing_consent = public.contacts.marketing_consent or excluded.marketing_consent,
    consent_at = case when public.contacts.marketing_consent then public.contacts.consent_at else excluded.consent_at end,
    consent_source = case when public.contacts.marketing_consent then public.contacts.consent_source else excluded.consent_source end;

  update public.orders
  set status = 'paid', capture_id = coalesce(capture, capture_id), profile_id = buyer, paid_at = now()
  where id = o.id
  returning * into o;
  return o;
end;
$$;

-- ---------------------------------------------------------------------------
-- Channels: group, kind, privacy, read-only (replaces visibility)
-- ---------------------------------------------------------------------------

alter table public.channels
  add column access_group_id uuid references public.access_groups (id) on delete restrict,
  add column kind text not null default 'feed' constraint channels_kind check (kind in ('feed', 'chat')),
  add column privacy text not null default 'public' constraint channels_privacy check (privacy in ('public', 'private')),
  add column read_only boolean not null default false;

update public.channels c set
  access_group_id = public.default_group(c.community_id),
  read_only = (c.visibility = 'read_only');

-- New channels without a group join the default group.
create function public.channels_group() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.access_group_id is null then
    new.access_group_id := public.default_group(new.community_id);
  end if;
  if (select g.community_id from public.access_groups g where g.id = new.access_group_id) is distinct from new.community_id then
    raise exception 'channel group must belong to its community' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger channels_group before insert or update on public.channels
  for each row execute function public.channels_group();

alter table public.channels alter column access_group_id set not null;
create index channels_group on public.channels (access_group_id);

-- Posts only in feed channels.
create function public.posts_feed_channel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select c.kind from public.channels c where c.id = new.channel_id) is distinct from 'feed' then
    raise exception 'posts only in feed channels' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger posts_feed_channel before insert or update on public.posts
  for each row execute function public.posts_feed_channel();

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (channel_id, profile_id)
);
create index channel_members_profile on public.channel_members (profile_id);

-- ---------------------------------------------------------------------------
-- Messages, DMs, blocks, settings
-- ---------------------------------------------------------------------------

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.products (id) on delete cascade,
  a_id uuid not null references public.profiles (id) on delete cascade,
  b_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dm_threads_pair check (a_id < b_id),
  unique (community_id, a_id, b_id)
);
create index dm_threads_a on public.dm_threads (community_id, a_id);
create index dm_threads_b on public.dm_threads (community_id, b_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels (id) on delete cascade,
  thread_id uuid references public.dm_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at timestamptz not null default now(),
  constraint messages_one_target check ((channel_id is null) <> (thread_id is null))
);
create index messages_channel on public.messages (channel_id, created_at);
create index messages_thread on public.messages (thread_id, created_at);

create function public.messages_chat_channel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.channel_id is not null
     and (select c.kind from public.channels c where c.id = new.channel_id) is distinct from 'chat' then
    raise exception 'messages only in chat channels' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger messages_chat_channel before insert or update on public.messages
  for each row execute function public.messages_chat_channel();

create table public.dm_reads (
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create table public.blocks (
  community_id uuid not null references public.products (id) on delete cascade,
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  primary key (community_id, blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked on public.blocks (community_id, blocked_id);

-- No row = defaults (DEFAULT_COMMUNITY_SETTINGS).
create table public.community_settings (
  community_id uuid primary key references public.products (id) on delete cascade,
  dms_enabled boolean not null default true,
  founder_dms boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Helpers (mirror src/features/community/api/access.ts and chat.ts)
-- ---------------------------------------------------------------------------

create function public.can_edit_community(target_community uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.reaches_community(target_community)
    and public.has_capability(public.product_space(target_community), 'products.edit');
$$;

-- Groups the caller holds as a member of a published community (null grant group = default).
create function public.member_groups(target_community uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct coalesce(g.access_group_id, public.default_group(p.id))
  from public.grants g join public.products p on p.id = g.product_id
  where p.id = target_community and p.kind = 'community' and p.status = 'published'
    and g.profile_id = auth.uid() and g.status = 'active'
    and (g.expires_at is null or g.expires_at > now());
$$;

-- Directory + DMs toggles: staff always, members by union over their groups.
create function public.community_feature(target_community uuid, feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.reaches_community(target_community) or exists (
    select 1 from public.access_groups ag
    where ag.id in (select public.member_groups(target_community))
      and case feature when 'directory' then ag.directory when 'dms' then ag.dms else false end
  );
$$;

create function public.can_read_channel(target_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.reaches_community(c.community_id) or (
      c.access_group_id in (select public.member_groups(c.community_id))
      and (c.privacy = 'public' or exists (
        select 1 from public.channel_members cm where cm.channel_id = c.id and cm.profile_id = auth.uid()))
    )
    from public.channels c where c.id = target_channel
  ), false);
$$;

-- Read-only channels: only post moderators post (feed) or send (chat).
create or replace function public.can_post_in(target_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_channel(c.id)
      and (not c.read_only or public.can_moderate_posts(c.community_id))
    from public.channels c where c.id = target_channel
  ), false);
$$;

create or replace function public.can_read_post(target_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_channel(p.channel_id)
      and (p.hidden_at is null or public.can_moderate_posts(public.post_community(p.id)))
    from public.posts p where p.id = target_post
  ), false);
$$;

alter table public.channels drop column visibility;

-- Member of a community = staff reaching it or active grant holder (directory()).
create function public.is_community_member(target_community uuid, target_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p
    join public.space_members m on m.space_id = p.space_id and m.profile_id = target_profile
    where p.id = target_community
      and (m.role = any (array['owner', 'admin']) or exists (
        select 1 from public.space_member_communities t
        where t.community_id = p.id and t.profile_id = target_profile))
  ) or exists (
    select 1 from public.grants g
    where g.product_id = target_community and g.profile_id = target_profile and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
  );
$$;

-- canReply: DMs on, both members, not self, no block either way.
create function public.can_reply_dm(target_community uuid, other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.dms_enabled from public.community_settings s where s.community_id = target_community), true)
    and other <> auth.uid()
    and public.can_read_community(target_community)
    and public.is_community_member(target_community, auth.uid())
    and public.is_community_member(target_community, other)
    and not exists (
      select 1 from public.blocks b
      where b.community_id = target_community
        and ((b.blocker_id = auth.uid() and b.blocked_id = other) or (b.blocker_id = other and b.blocked_id = auth.uid()))
    );
$$;

-- canStart: canReply and (staff, or a group with DMs and the owner only while founder DMs are on).
create function public.can_start_dm(target_community uuid, other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_reply_dm(target_community, other) and (
    public.reaches_community(target_community) or (
      public.community_feature(target_community, 'dms')
      and (
        coalesce((select s.founder_dms from public.community_settings s where s.community_id = target_community), true)
        or not exists (
          select 1 from public.space_members m
          where m.space_id = public.product_space(target_community) and m.profile_id = other and m.role = 'owner')
      )
    )
  );
$$;

create function public.is_dm_participant(target_thread uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dm_threads t where t.id = target_thread and auth.uid() in (t.a_id, t.b_id));
$$;

create function public.can_send_dm(target_thread uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_reply_dm(t.community_id, case when t.a_id = auth.uid() then t.b_id else t.a_id end)
    from public.dm_threads t where t.id = target_thread and auth.uid() in (t.a_id, t.b_id)
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.access_groups enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_reads enable row level security;
alter table public.blocks enable row level security;
alter table public.community_settings enable row level security;

drop policy channels_read on public.channels;
create policy channels_read on public.channels for select using (public.can_read_channel(id));

create policy access_groups_read on public.access_groups for select
  using (public.can_read_community(community_id));
create policy access_groups_write on public.access_groups for all
  using (public.can_edit_community(community_id))
  with check (public.can_edit_community(community_id));

-- Invites: staff manage; members see their own rows.
create policy channel_members_read on public.channel_members for select
  using (profile_id = auth.uid() or public.reaches_community(public.channel_community(channel_id)));
create policy channel_members_write on public.channel_members for all
  using (public.can_edit_community(public.channel_community(channel_id)))
  with check (public.can_edit_community(public.channel_community(channel_id)));

create policy messages_read on public.messages for select
  using (case when channel_id is not null then public.can_read_channel(channel_id) else public.is_dm_participant(thread_id) end);
create policy messages_insert on public.messages for insert
  with check (
    author_id = auth.uid()
    and case when channel_id is not null then public.can_post_in(channel_id) else public.can_send_dm(thread_id) end
  );
-- Channel lines: author or post moderator. DM lines: author only.
create policy messages_delete on public.messages for delete
  using (
    author_id = auth.uid()
    or (channel_id is not null and public.can_read_channel(channel_id)
        and public.can_moderate_posts(public.channel_community(channel_id)))
  );

create policy dm_threads_read on public.dm_threads for select using (auth.uid() in (a_id, b_id));
create policy dm_threads_insert on public.dm_threads for insert
  with check (
    auth.uid() in (a_id, b_id)
    and public.can_start_dm(community_id, case when a_id = auth.uid() then b_id else a_id end)
  );

create policy dm_reads_own on public.dm_reads for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_dm_participant(thread_id));

-- Blocks: each side sees rows that involve them; only the blocker writes.
create policy blocks_read on public.blocks for select using (auth.uid() in (blocker_id, blocked_id));
create policy blocks_insert on public.blocks for insert
  with check (
    blocker_id = auth.uid()
    and public.is_community_member(community_id, auth.uid())
    and public.is_community_member(community_id, blocked_id)
  );
create policy blocks_delete on public.blocks for delete using (blocker_id = auth.uid());

create policy community_settings_read on public.community_settings for select
  using (public.can_read_community(community_id));
create policy community_settings_write on public.community_settings for all
  using (public.can_edit_community(community_id))
  with check (public.can_edit_community(community_id));
