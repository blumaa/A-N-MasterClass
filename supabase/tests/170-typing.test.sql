-- Launch 6 item 7: typing topics. Receive = read right. Send = post right. Data topics stay database-only.
begin;
select plan(20);

do $$
declare
  s uuid := '17171717-1717-4717-8717-171717171717';
  comm uuid := 'c1700000-0000-4000-8000-000000000001';
  a uuid;
  b uuid;
begin
  perform tests.create_supabase_user('typing-owner');
  perform tests.create_supabase_user('typing-a');
  perform tests.create_supabase_user('typing-b');
  perform tests.create_supabase_user('typing-stranger');
  a := tests.get_supabase_uid('typing-a');
  b := tests.get_supabase_uid('typing-b');
  insert into public.spaces (id, slug, name, status) values (s, 'sqltest-typing', 'SQL test', 'live');
  insert into public.space_members values (s, tests.get_supabase_uid('typing-owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('typing-owner'), 'Owner'), (s, a, 'A'), (s, b, 'B');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, s, 'community', 'community', 'Community', 'published');
  insert into public.grants (product_id, profile_id, source) values (comm, a, 'manual'), (comm, b, 'manual');
  insert into public.channels (id, community_id, title, kind, position, read_only) values
    ('e1700000-0000-4000-8000-000000000001', comm, 'Chat', 'chat', 0, false),
    ('e1700000-0000-4000-8000-000000000002', comm, 'News', 'chat', 1, true);
  insert into public.dm_threads (id, community_id, a_id, b_id) values
    ('d1700000-0000-4000-8000-000000000001', comm, least(a, b), greatest(a, b));
end $$;

-- Member: receives and sends typing where they may post.
select tests.authenticate_as('typing-a');
select ok(public.can_join_live('typing-channel:e1700000-0000-4000-8000-000000000001'), 'member joins chat typing');
select ok(public.can_send_live('typing-channel:e1700000-0000-4000-8000-000000000001'), 'member sends chat typing');
select ok(public.can_join_live('typing-channel:e1700000-0000-4000-8000-000000000002'), 'member receives read-only channel typing');
select ok(not public.can_send_live('typing-channel:e1700000-0000-4000-8000-000000000002'), 'member does not send in read-only channel');
select ok(public.can_join_live('typing-dm:d1700000-0000-4000-8000-000000000001'), 'participant joins dm typing');
select ok(public.can_send_live('typing-dm:d1700000-0000-4000-8000-000000000001'), 'participant sends dm typing');

-- Data topics: never sendable by clients.
select ok(not public.can_send_live('channel:e1700000-0000-4000-8000-000000000001'), 'no send on channel data topic');
select ok(not public.can_send_live('dm:d1700000-0000-4000-8000-000000000001'), 'no send on dm data topic');
select ok(not public.can_send_live('typing-post:e1700000-0000-4000-8000-000000000001'), 'unknown typing kind refused');
select ok(not public.can_send_live('typing-channel:nope'), 'malformed topic refused');
select ok(not public.can_send_live(null), 'null topic refused');

-- Staff post in read-only channels, but never join others' DMs.
select tests.authenticate_as('typing-owner');
select ok(public.can_send_live('typing-channel:e1700000-0000-4000-8000-000000000002'), 'staff send in read-only channel');
select ok(not public.can_join_live('typing-dm:d1700000-0000-4000-8000-000000000001'), 'staff do not join others dm typing');
select ok(not public.can_send_live('typing-dm:d1700000-0000-4000-8000-000000000001'), 'staff do not send in others dm');

-- Stranger: nothing.
select tests.authenticate_as('typing-stranger');
select ok(not public.can_join_live('typing-channel:e1700000-0000-4000-8000-000000000001'), 'stranger does not join chat typing');
select ok(not public.can_send_live('typing-channel:e1700000-0000-4000-8000-000000000001'), 'stranger does not send chat typing');
select ok(not public.can_join_live('typing-dm:d1700000-0000-4000-8000-000000000001'), 'stranger does not join dm typing');

-- Blocked DM: still a participant (reads), but may not send.
reset role;
insert into public.blocks (community_id, blocker_id, blocked_id) values
  ('c1700000-0000-4000-8000-000000000001', tests.get_supabase_uid('typing-b'), tests.get_supabase_uid('typing-a'));
select tests.authenticate_as('typing-a');
select ok(public.can_join_live('typing-dm:d1700000-0000-4000-8000-000000000001'), 'blocked participant still receives');
select ok(not public.can_send_live('typing-dm:d1700000-0000-4000-8000-000000000001'), 'blocked participant does not send');

-- Insert policy round trip. realtime.messages is partitioned by day by the Realtime service; no partition: skip.
create function pg_temp.has_partition() returns boolean language sql as $$
  select exists (select 1 from pg_inherits i join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'realtime.messages'::regclass
      and pg_get_expr(c.relpartbound, c.oid) like 'FOR VALUES FROM (''' || current_date || '%');
$$;
select tests.authenticate_as('typing-b');
select set_config('realtime.topic', 'typing-channel:e1700000-0000-4000-8000-000000000001', true);
select case when pg_temp.has_partition() then lives_ok($$ insert into realtime.messages (topic, extension, event, payload, private)
    values ('typing-channel:e1700000-0000-4000-8000-000000000001', 'broadcast', 'typing', '{}', true) $$,
    'poster may send typing')
  else skip('no realtime.messages partition today', 1) end;

select * from finish(true);
rollback;
