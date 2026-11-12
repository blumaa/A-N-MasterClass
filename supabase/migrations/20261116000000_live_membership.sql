-- Group 2 live updates. Same mechanism as 20261112110000_live_topics.sql (empty 'stale' hint, invalidate only).
-- New topic community:<id>: channels, groups, settings and membership of one community changed.
-- Join = can_read_community. Blocks hint both inboxes (nav badge, DM thread pages listen there).
-- Topic names: SSOT with src/lib/realtime/topics.ts. Change both together.
-- Docs: https://supabase.com/docs/guides/realtime/authorization
--       https://supabase.com/docs/guides/realtime/broadcast (broadcast from the database)

create or replace function public.can_join_live(topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := split_part(topic, ':', 1);
  id uuid;
begin
  if topic is null or topic !~ '^(community|channel|post|dm|inbox|typing-channel|typing-dm):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  id := split_part(topic, ':', 2)::uuid;
  return coalesce(case kind
    when 'community' then public.can_read_community(id)
    when 'channel' then public.can_read_channel(id)
    when 'typing-channel' then public.can_read_channel(id)
    when 'post' then public.can_read_post(id)
    when 'dm' then public.is_dm_participant(id)
    when 'typing-dm' then public.is_dm_participant(id)
    when 'inbox' then id = auth.uid()
  end, false);
end;
$$;

create or replace function public.live_topics(tbl text, r jsonb) returns setof text
language plpgsql stable security definer set search_path = '' as $$
begin
  case tbl
  when 'messages' then
    if r->>'channel_id' is not null then
      return next 'channel:' || (r->>'channel_id');
    else
      return next 'dm:' || (r->>'thread_id');
      return query select 'inbox:' || p from public.dm_threads t, unnest(array[t.a_id, t.b_id]) p
        where t.id = (r->>'thread_id')::uuid;
    end if;
  when 'posts' then
    return next 'post:' || (r->>'id');
    return next 'channel:' || (r->>'channel_id');
  when 'post_photos' then
    return query select public.live_post_topics((r->>'post_id')::uuid);
  when 'comments' then
    if r->>'target_type' = 'post' then
      return query select public.live_post_topics((r->>'target_id')::uuid);
    end if;
  when 'reactions' then
    if r->>'target_type' = 'post' then
      return query select public.live_post_topics((r->>'target_id')::uuid);
    else
      return query select public.live_post_topics(c.target_id) from public.comments c
        where c.id = (r->>'target_id')::uuid and c.target_type = 'post';
    end if;
  -- Community structure and membership.
  when 'channels', 'access_groups', 'community_settings', 'post_approval_members', 'space_member_communities' then
    return next 'community:' || (r->>'community_id');
  when 'channel_members', 'channel_moderators' then
    return query select 'community:' || c.community_id from public.channels c where c.id = (r->>'channel_id')::uuid;
  when 'grants' then
    return query select 'community:' || p.id from public.products p
      where p.id = (r->>'product_id')::uuid and p.kind = 'community';
  when 'space_members' then
    return query select 'community:' || p.id from public.products p
      where p.space_id = (r->>'space_id')::uuid and p.kind = 'community';
  when 'blocks' then
    return next 'inbox:' || (r->>'blocker_id');
    return next 'inbox:' || (r->>'blocked_id');
  end case;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['channels', 'access_groups', 'community_settings', 'post_approval_members',
    'space_member_communities', 'channel_members', 'channel_moderators', 'grants', 'space_members', 'blocks'] loop
    execute format('create trigger %I after insert on public.%I referencing new table as new_rows
      for each statement execute function public.live_notify()', tbl || '_live_insert', tbl);
    execute format('create trigger %I after update on public.%I referencing new table as new_rows old table as old_rows
      for each statement execute function public.live_notify()', tbl || '_live_update', tbl);
    execute format('create trigger %I after delete on public.%I referencing old table as old_rows
      for each statement execute function public.live_notify()', tbl || '_live_delete', tbl);
  end loop;
end $$;
