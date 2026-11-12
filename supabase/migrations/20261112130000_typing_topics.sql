-- Launch 6 item 7: typing indicators over private Realtime broadcast.
-- Own topics (typing-channel:<id>, typing-dm:<id>) so clients never send on the data topics,
-- which stay database-only ('stale' hints). Receive = read right. Send = post right.
-- Realtime checks these policies on join and caches them for the connection.
-- Topic names: SSOT with src/lib/realtime/topics.ts. Change both together.
-- Docs: https://supabase.com/docs/guides/realtime/authorization

create or replace function public.can_join_live(topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := split_part(topic, ':', 1);
  id uuid;
begin
  if topic is null or topic !~ '^(channel|post|dm|inbox|typing-channel|typing-dm):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  id := split_part(topic, ':', 2)::uuid;
  return coalesce(case kind
    when 'channel' then public.can_read_channel(id)
    when 'typing-channel' then public.can_read_channel(id)
    when 'post' then public.can_read_post(id)
    when 'dm' then public.is_dm_participant(id)
    when 'typing-dm' then public.is_dm_participant(id)
    when 'inbox' then id = auth.uid()
  end, false);
end;
$$;

-- Who may send on a topic: typing topics only, and only people who may post there.
create function public.can_send_live(topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  id uuid;
begin
  if topic is null or topic !~ '^typing-(channel|dm):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  id := split_part(topic, ':', 2)::uuid;
  return case split_part(topic, ':', 1)
    when 'typing-channel' then public.can_post_in(id)
    else public.can_send_dm(id)
  end;
end;
$$;
revoke execute on function public.can_send_live(text) from public, anon;
grant execute on function public.can_send_live(text) to authenticated, service_role;

create policy live_typing_send on realtime.messages for insert to authenticated
  with check (extension = 'broadcast' and public.can_send_live((select realtime.topic())));
