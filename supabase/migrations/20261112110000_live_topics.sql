-- Launch 6 item 5: live updates over Supabase Realtime, invalidate only.
-- Writes send an empty 'stale' broadcast to private topics. Clients refetch over RLS.
-- Joining a topic needs the same read right as the rows it names (policy on realtime.messages).
-- Topic names: SSOT with src/lib/realtime/topics.ts. Change both together.
-- Docs: https://supabase.com/docs/guides/realtime/authorization
--       https://supabase.com/docs/guides/realtime/broadcast (broadcast from the database)

-- ---------------------------------------------------------------------------
-- Who may join a topic
-- ---------------------------------------------------------------------------

create function public.can_join_live(topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := split_part(topic, ':', 1);
  id uuid;
begin
  if topic is null or topic !~ '^(channel|post|dm|inbox):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  id := split_part(topic, ':', 2)::uuid;
  return coalesce(case kind
    when 'channel' then public.can_read_channel(id)
    when 'post' then public.can_read_post(id)
    when 'dm' then public.is_dm_participant(id)
    when 'inbox' then id = auth.uid()
  end, false);
end;
$$;
revoke execute on function public.can_join_live(text) from public, anon;
grant execute on function public.can_join_live(text) to authenticated, service_role;

-- Receive only. No insert policy: clients cannot send (item 7 adds one for typing).
create policy live_topics_read on realtime.messages for select to authenticated
  using (extension = 'broadcast' and public.can_join_live((select realtime.topic())));

-- ---------------------------------------------------------------------------
-- Which topics a changed row makes stale
-- ---------------------------------------------------------------------------

-- Topics of a feed post: its page and its channel (counts and previews show there).
create function public.live_post_topics(target_post uuid) returns setof text
language sql stable security definer set search_path = '' as $$
  select 'post:' || target_post
  union all
  select 'channel:' || p.channel_id from public.posts p where p.id = target_post;
$$;

create function public.live_topics(tbl text, r jsonb) returns setof text
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
  end case;
end;
$$;

-- Empty payload: the event says "stale", never what changed.
create function public.live_send(topic text) returns void
language sql security definer set search_path = '' as $$
  select realtime.send('{}'::jsonb, 'stale', topic, true);
$$;

-- Statement trigger: one send per distinct topic, even for bulk writes and cascades.
create function public.live_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changed text := case tg_op
    when 'INSERT' then 'select to_jsonb(n) j from new_rows n'
    when 'DELETE' then 'select to_jsonb(o) j from old_rows o'
    else 'select to_jsonb(n) j from new_rows n union all select to_jsonb(o) from old_rows o'
  end;
begin
  execute format(
    'select public.live_send(t) from (select distinct t from (%s) c, public.live_topics(%L, c.j) t where t is not null) x',
    changed, tg_table_name);
  return null;
end;
$$;

revoke execute on function public.live_post_topics(uuid) from public, anon, authenticated;
revoke execute on function public.live_topics(text, jsonb) from public, anon, authenticated;
revoke execute on function public.live_send(text) from public, anon, authenticated;
revoke execute on function public.live_notify() from public, anon, authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['messages', 'posts', 'post_photos', 'comments', 'reactions'] loop
    execute format('create trigger %I after insert on public.%I referencing new table as new_rows
      for each statement execute function public.live_notify()', tbl || '_live_insert', tbl);
    execute format('create trigger %I after update on public.%I referencing new table as new_rows old table as old_rows
      for each statement execute function public.live_notify()', tbl || '_live_update', tbl);
    execute format('create trigger %I after delete on public.%I referencing old table as old_rows
      for each statement execute function public.live_notify()', tbl || '_live_delete', tbl);
  end loop;
end $$;
