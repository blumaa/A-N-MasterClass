-- Group 2 live updates: community topic (channels, groups, settings, membership) and blocks on inboxes.
begin;
select plan(24);

do $$
declare
  s uuid := '30303030-3030-4030-8030-303030303030';
  comm uuid := 'c3000000-0000-4000-8000-000000000001';
  a uuid;
  b uuid;
begin
  perform tests.create_supabase_user('lm-owner');
  perform tests.create_supabase_user('lm-a');
  perform tests.create_supabase_user('lm-b');
  perform tests.create_supabase_user('lm-stranger');
  a := tests.get_supabase_uid('lm-a');
  b := tests.get_supabase_uid('lm-b');
  insert into public.spaces (id, slug, name, status) values (s, 'sqltest-live-membership', 'SQL test', 'live');
  insert into public.space_members values (s, tests.get_supabase_uid('lm-owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('lm-owner'), 'Owner'), (s, a, 'A'), (s, b, 'B');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, s, 'community', 'community', 'Community', 'published'),
    ('c3000000-0000-4000-8000-000000000002', s, 'community', 'draft', 'Draft', 'draft'),
    ('c3000000-0000-4000-8000-000000000003', s, 'program', 'program', 'Program', 'published');
  insert into public.grants (product_id, profile_id, source) values (comm, a, 'manual');
  insert into public.channels (id, community_id, title, kind, position) values
    ('e3000000-0000-4000-8000-000000000001', comm, 'Feed', 'feed', 0);
end $$;

-- Join rights: community topic = read right on the community.
select tests.authenticate_as('lm-a');
select ok(public.can_join_live('community:c3000000-0000-4000-8000-000000000001'), 'member joins community');
select ok(not public.can_join_live('community:c3000000-0000-4000-8000-000000000002'), 'member does not join draft community');
select ok(not public.can_join_live('community:e3000000-0000-4000-8000-000000000001'), 'channel id is no community');
select tests.authenticate_as('lm-stranger');
select ok(not public.can_join_live('community:c3000000-0000-4000-8000-000000000001'), 'stranger does not join community');
select tests.authenticate_as('lm-owner');
select ok(public.can_join_live('community:c3000000-0000-4000-8000-000000000002'), 'staff join draft community');

-- Triggers: record sends instead of broadcasting (function swap is rolled back).
reset role;
create temp table sent (topic text) on commit drop;
grant insert on sent to public;
create or replace function public.live_send(topic text) returns void
language sql security definer set search_path = '' as $$ insert into pg_temp.sent values (topic) $$;
create function pg_temp.hints(t text) returns int language sql as $$ select count(*)::int from pg_temp.sent where topic = t $$;
create function pg_temp.comm() returns int language sql as $$ select pg_temp.hints('community:c3000000-0000-4000-8000-000000000001') $$;
create function pg_temp.inbox(who text) returns int language sql as $$ select pg_temp.hints('inbox:' || tests.get_supabase_uid(who)) $$;

-- Channels
insert into public.channels (id, community_id, title, kind, position) values
  ('e3000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000001', 'Chat', 'chat', 1),
  ('e3000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000001', 'Private', 'chat', 2);
select is(pg_temp.comm(), 1, 'new channels: one hint per statement');
update public.channels set read_only = true where id = 'e3000000-0000-4000-8000-000000000002';
select is(pg_temp.comm(), 2, 'channel change hints its community');
delete from public.channels where id = 'e3000000-0000-4000-8000-000000000002';
select is(pg_temp.comm(), 3, 'channel delete hints its community');

-- Channel membership and moderators
insert into public.channel_members (channel_id, profile_id)
  values ('e3000000-0000-4000-8000-000000000003', tests.get_supabase_uid('lm-a'));
select is(pg_temp.comm(), 4, 'channel invite hints the community');
delete from public.channel_members where channel_id = 'e3000000-0000-4000-8000-000000000003';
select is(pg_temp.comm(), 5, 'channel removal hints the community');
insert into public.channel_moderators (channel_id, profile_id)
  values ('e3000000-0000-4000-8000-000000000001', tests.get_supabase_uid('lm-a'));
select is(pg_temp.comm(), 6, 'new channel moderator hints the community');
insert into public.post_approval_members (community_id, profile_id)
  values ('c3000000-0000-4000-8000-000000000001', tests.get_supabase_uid('lm-a'));
select is(pg_temp.comm(), 7, 'post approval member hints the community');

-- Groups and settings
insert into public.access_groups (community_id, title) values ('c3000000-0000-4000-8000-000000000001', 'VIP');
select is(pg_temp.comm(), 8, 'new group hints the community');
update public.access_groups set dms = false where community_id = 'c3000000-0000-4000-8000-000000000001';
select is(pg_temp.comm(), 9, 'group toggles hint the community once');
insert into public.community_settings (community_id, dms_enabled) values ('c3000000-0000-4000-8000-000000000001', false);
select is(pg_temp.comm(), 10, 'settings hint the community');

-- Grants
insert into public.grants (product_id, profile_id, source) values
  ('c3000000-0000-4000-8000-000000000001', tests.get_supabase_uid('lm-b'), 'manual');
select is(pg_temp.comm(), 11, 'new member hints the community');
update public.grants set status = 'revoked' where profile_id = tests.get_supabase_uid('lm-b');
select is(pg_temp.comm(), 12, 'revoked grant hints the community');
insert into public.grants (product_id, profile_id, source) values
  ('c3000000-0000-4000-8000-000000000003', tests.get_supabase_uid('lm-b'), 'manual');
select is((select count(*)::int from pg_temp.sent where topic like 'community:c3000000-0000-4000-8000-000000000003'), 0,
  'program grant hints nothing');

-- Staff reach
insert into public.space_members values
  ('30303030-3030-4030-8030-303030303030', tests.get_supabase_uid('lm-stranger'), 'assistant', now());
select is(pg_temp.comm(), 13, 'new staff hints every community of the space');
select is(pg_temp.hints('community:c3000000-0000-4000-8000-000000000002'), 1, 'draft community too');
insert into public.space_member_communities values ('c3000000-0000-4000-8000-000000000001', tests.get_supabase_uid('lm-stranger'));
select is(pg_temp.comm(), 14, 'staff reach hints the community');

-- Blocks: both inboxes (DM thread pages and nav listen there).
insert into public.blocks (community_id, blocker_id, blocked_id)
  values ('c3000000-0000-4000-8000-000000000001', tests.get_supabase_uid('lm-a'), tests.get_supabase_uid('lm-b'));
select is(pg_temp.inbox('lm-a'), 1, 'block hints the blocker inbox');
select is(pg_temp.inbox('lm-b'), 1, 'block hints the blocked inbox');
delete from public.blocks where community_id = 'c3000000-0000-4000-8000-000000000001';
select is(pg_temp.inbox('lm-b'), 2, 'unblock hints the inbox again');

select * from finish(true);
rollback;
