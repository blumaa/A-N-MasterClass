-- Launch 6 item 5: Realtime topics. Join rights follow read rights; writes send empty 'stale' hints.
begin;
select plan(28);

do $$
declare
  s uuid := '15151515-1515-4515-8515-151515151515';
  comm uuid := 'c1500000-0000-4000-8000-000000000001';
  a uuid;
  b uuid;
begin
  perform tests.create_supabase_user('live-owner');
  perform tests.create_supabase_user('live-a');
  perform tests.create_supabase_user('live-b');
  perform tests.create_supabase_user('live-stranger');
  a := tests.get_supabase_uid('live-a');
  b := tests.get_supabase_uid('live-b');
  insert into public.spaces (id, slug, name, status) values (s, 'sqltest-live-topics', 'SQL test', 'live');
  insert into public.space_members values (s, tests.get_supabase_uid('live-owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('live-owner'), 'Owner'), (s, a, 'A'), (s, b, 'B');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, s, 'community', 'community', 'Community', 'published');
  insert into public.grants (product_id, profile_id, source) values (comm, a, 'manual'), (comm, b, 'manual');
  insert into public.channels (id, community_id, title, kind, position) values
    ('e1500000-0000-4000-8000-000000000001', comm, 'Feed', 'feed', 0),
    ('e1500000-0000-4000-8000-000000000002', comm, 'Chat', 'chat', 1);
  insert into public.posts (id, channel_id, author_id, body, hidden_at) values
    ('f1500000-0000-4000-8000-000000000001', 'e1500000-0000-4000-8000-000000000001', a, 'post', null),
    ('f1500000-0000-4000-8000-000000000002', 'e1500000-0000-4000-8000-000000000001', a, 'hidden', now());
  insert into public.dm_threads (id, community_id, a_id, b_id) values
    ('d1500000-0000-4000-8000-000000000001', comm, least(a, b), greatest(a, b));
end $$;

-- Topic of a test user's own row.
create function pg_temp.uid_topic(kind text, who text) returns text language sql as $$
  select kind || ':' || tests.get_supabase_uid(who);
$$;

-- Join rights
select tests.authenticate_as('live-a');
select ok(public.can_join_live('channel:e1500000-0000-4000-8000-000000000001'), 'member joins channel');
select ok(public.can_join_live('post:f1500000-0000-4000-8000-000000000001'), 'member joins post');
select ok(not public.can_join_live('post:f1500000-0000-4000-8000-000000000002'), 'member does not join hidden post');
select ok(public.can_join_live('dm:d1500000-0000-4000-8000-000000000001'), 'participant joins dm');
select ok(public.can_join_live(pg_temp.uid_topic('inbox', 'live-a')), 'own inbox');
select ok(not public.can_join_live(pg_temp.uid_topic('inbox', 'live-b')), 'not another inbox');
select ok(not public.can_join_live('channel:nope'), 'malformed topic refused');
select ok(not public.can_join_live('space:15151515-1515-4515-8515-151515151515'), 'unknown kind refused');
select ok(not public.can_join_live(null), 'null topic refused');
select ok(not public.can_join_live('channel:e1500000-0000-4000-8000-00000000000f'), 'missing channel refused');

select tests.authenticate_as('live-stranger');
select ok(not public.can_join_live('channel:e1500000-0000-4000-8000-000000000001'), 'stranger does not join channel');
select ok(not public.can_join_live('post:f1500000-0000-4000-8000-000000000001'), 'stranger does not join post');
select ok(not public.can_join_live('dm:d1500000-0000-4000-8000-000000000001'), 'stranger does not join dm');

select tests.authenticate_as('live-owner');
select ok(public.can_join_live('post:f1500000-0000-4000-8000-000000000002'), 'moderator joins hidden post');
select ok(not public.can_join_live('dm:d1500000-0000-4000-8000-000000000001'), 'staff do not join others dm');

-- Round trip through realtime.messages. It is partitioned by day and the Realtime service makes
-- the partitions while clients are connected; we cannot (schema owned by Supabase). No partition: skip.
create function pg_temp.has_partition() returns boolean language sql as $$
  select exists (select 1 from pg_inherits i join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'realtime.messages'::regclass
      and pg_get_expr(c.relpartbound, c.oid) like 'FOR VALUES FROM (''' || current_date || '%');
$$;
reset role;
do $$ begin
  if pg_temp.has_partition() then perform public.live_send('dm:d1500000-0000-4000-8000-000000000001'); end if;
end $$;
select case when pg_temp.has_partition() then ok(exists (select 1 from realtime.messages m
    where m.topic = 'dm:d1500000-0000-4000-8000-000000000001' and m.event = 'stale' and m.private
      and m.extension = 'broadcast' and m.payload - 'id' = '{}'::jsonb), 'hint is private, empty, event stale')
  else skip('no realtime.messages partition today', 1) end;
select tests.authenticate_as('live-b');
select set_config('realtime.topic', 'dm:d1500000-0000-4000-8000-000000000001', true);
select case when pg_temp.has_partition() then ok((select count(*) from realtime.messages
    where topic = 'dm:d1500000-0000-4000-8000-000000000001') > 0, 'participant may receive dm hints')
  else skip('no realtime.messages partition today', 1) end;
select tests.authenticate_as('live-stranger');
select set_config('realtime.topic', 'dm:d1500000-0000-4000-8000-000000000001', true);
select is((select count(*)::int from realtime.messages where topic = 'dm:d1500000-0000-4000-8000-000000000001'), 0,
  'stranger may not receive dm hints');
select case when pg_temp.has_partition() then throws_ok($$ insert into realtime.messages (topic, extension, event, payload, private)
    values ('dm:d1500000-0000-4000-8000-000000000001', 'broadcast', 'stale', '{}', true) $$,
    '42501', null, 'clients cannot send')
  else skip('no realtime.messages partition today', 1) end;

-- Triggers: record sends instead of broadcasting (function swap is rolled back).
reset role;
create temp table sent (topic text) on commit drop;
grant insert on sent to public;
create or replace function public.live_send(topic text) returns void
language sql security definer set search_path = '' as $$ insert into pg_temp.sent values (topic) $$;
create function pg_temp.hints(t text) returns int language sql as $$ select count(*)::int from pg_temp.sent where topic = t $$;

select tests.authenticate_as('live-a');
insert into public.messages (channel_id, author_id, body)
  select 'e1500000-0000-4000-8000-000000000002', tests.get_supabase_uid('live-a'), 'line ' || n from generate_series(1, 3) n;
insert into public.messages (thread_id, author_id, body)
  values ('d1500000-0000-4000-8000-000000000001', tests.get_supabase_uid('live-a'), 'hi');
insert into public.comments (id, space_id, target_type, target_id, author_id, body) values
  ('a1500000-0000-4000-8000-000000000001', '15151515-1515-4515-8515-151515151515', 'post',
   'f1500000-0000-4000-8000-000000000001', tests.get_supabase_uid('live-a'), 'nice');
reset role;
select is(pg_temp.hints('channel:e1500000-0000-4000-8000-000000000002'), 1, 'chat lines: one hint per statement');
select is(pg_temp.hints('dm:d1500000-0000-4000-8000-000000000001'), 1, 'dm line hints the thread');
select is(pg_temp.hints(pg_temp.uid_topic('inbox', 'live-a')), 1, 'dm line hints sender inbox');
select is(pg_temp.hints(pg_temp.uid_topic('inbox', 'live-b')), 1, 'dm line hints receiver inbox');
select is(pg_temp.hints('post:f1500000-0000-4000-8000-000000000001'), 1, 'comment hints the post');
select is(pg_temp.hints('channel:e1500000-0000-4000-8000-000000000001'), 1, 'comment hints the feed channel');

select tests.authenticate_as('live-b');
insert into public.reactions (target_type, target_id, profile_id, emoji) values
  ('comment', 'a1500000-0000-4000-8000-000000000001', tests.get_supabase_uid('live-b'), '👍');
reset role;
select is(pg_temp.hints('post:f1500000-0000-4000-8000-000000000001'), 2, 'reaction on a comment hints its post');

update public.posts set hidden_at = now() where id = 'f1500000-0000-4000-8000-000000000001';
select is(pg_temp.hints('channel:e1500000-0000-4000-8000-000000000001'), 3, 'hiding a post hints its channel');
delete from public.posts where id = 'f1500000-0000-4000-8000-000000000001';
select ok(pg_temp.hints('post:f1500000-0000-4000-8000-000000000001') > 3, 'deleted post hints its page');

select * from finish(true);
rollback;
