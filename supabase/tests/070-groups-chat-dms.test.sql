-- Launch 2: access groups (default group, per-group channels, grants per group), chat shape,
-- private channels, DMs (start, send, settings, blocks).
begin;
select plan(24);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  comm uuid := 'c0000000-0000-4000-8000-000000000001';
  prog uuid := 'a0000000-0000-4000-8000-000000000001';
  vip uuid := '70000000-0000-4000-8000-000000000001';
  general uuid := 'e0000000-0000-4000-8000-000000000001';
  lounge uuid := 'e0000000-0000-4000-8000-000000000002';
  vip_chat uuid := 'e0000000-0000-4000-8000-000000000003';
  secret uuid := 'e0000000-0000-4000-8000-000000000004';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('member');
  perform tests.create_supabase_user('vip');
  perform tests.create_supabase_user('stranger');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live');
  insert into public.space_members values (a, tests.get_supabase_uid('owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (a, tests.get_supabase_uid('owner'), 'Owner'),
    (a, tests.get_supabase_uid('member'), 'Member'),
    (a, tests.get_supabase_uid('vip'), 'Vip');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, a, 'community', 'community', 'Community', 'published'),
    (prog, a, 'program', 'rope-1', 'Rope 1', 'published');
  insert into public.access_groups (id, community_id, title) values (vip, comm, 'VIP');
  insert into public.grants (product_id, profile_id, source) values
    (comm, tests.get_supabase_uid('member'), 'manual');
  insert into public.grants (product_id, profile_id, access_group_id, source) values
    (comm, tests.get_supabase_uid('vip'), vip, 'manual');
  insert into public.channels (id, community_id, title, kind, position) values
    (general, comm, 'General', 'feed', 0),
    (lounge, comm, 'Lounge', 'chat', 1);
  insert into public.channels (id, community_id, title, kind, access_group_id, position) values
    (vip_chat, comm, 'VIP chat', 'chat', vip, 2);
  insert into public.channels (id, community_id, title, kind, privacy, position) values
    (secret, comm, 'Secret', 'chat', 'private', 3);
end $$;

-- Groups and shape guards
select results_eq($$ select title from public.access_groups
  where is_default and community_id = 'c0000000-0000-4000-8000-000000000001' $$, $$ values ('Members') $$,
  'community gets a default Members group');
select is_empty($$ select 1 from public.access_groups where community_id = 'a0000000-0000-4000-8000-000000000001' $$,
  'programs get no group');
select throws_ok($$ delete from public.access_groups
  where is_default and community_id = 'c0000000-0000-4000-8000-000000000001' $$, '23514', null, 'default group cannot be deleted');
select throws_ok($$ delete from public.access_groups where id = '70000000-0000-4000-8000-000000000001' $$,
  '23503', null, 'group in use cannot be deleted');
select throws_ok($$ insert into public.grants (product_id, profile_id, access_group_id, source)
  values ('a0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('stranger'),
          '70000000-0000-4000-8000-000000000001', 'manual') $$, '23514', null, 'grant group must belong to the product');
select lives_ok($$ insert into public.grants (product_id, profile_id, access_group_id, source)
  values ('c0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('member'),
          '70000000-0000-4000-8000-000000000001', 'manual') $$, 'member may hold a second group of one community');
select throws_ok($$ insert into public.posts (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000002', tests.get_supabase_uid('owner'), 'x') $$, '23514', null, 'no posts in chat channels');
select throws_ok($$ insert into public.messages (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('owner'), 'x') $$, '23514', null, 'no messages in feed channels');
select throws_ok($$ insert into public.messages (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000002', tests.get_supabase_uid('owner'), '   ') $$, '23514', null, 'blank message refused');
select throws_ok($$ insert into public.dm_threads (community_id, a_id, b_id)
  values ('c0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('owner'), tests.get_supabase_uid('owner')) $$,
  '23514', null, 'no self thread');

-- Remove the extra grant again: member is default group only below.
delete from public.grants where profile_id = tests.get_supabase_uid('member') and access_group_id is not null;

-- Member (default group)
select tests.authenticate_as('member');
select results_eq($$ select title from public.channels order by position $$, $$ values ('General'), ('Lounge') $$,
  'member reads own group public channels only');
select lives_ok($$ insert into public.messages (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000002', auth.uid(), 'hi') $$, 'member sends in chat channel');
select throws_ok($$ insert into public.messages (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000003', auth.uid(), 'x') $$, '42501', null, 'member cannot send in another group');
select lives_ok($$ insert into public.dm_threads (id, community_id, a_id, b_id) values
  ('d1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   least(auth.uid(), tests.get_supabase_uid('owner')), greatest(auth.uid(), tests.get_supabase_uid('owner'))) $$,
  'member starts a DM with the owner');
select lives_ok($$ insert into public.messages (thread_id, author_id, body)
  values ('d1000000-0000-4000-8000-000000000001', auth.uid(), 'hello') $$, 'member sends a DM');

-- VIP group
select tests.authenticate_as('vip');
select results_eq($$ select title from public.channels order by position $$, $$ values ('VIP chat') $$, 'vip reads VIP channel');
select is_empty($$ select 1 from public.messages $$, 'vip does not read other DMs or other group chats');

-- Stranger
select tests.authenticate_as('stranger');
select is_empty($$ select 1 from public.channels $$, 'stranger reads no channels');

-- Owner: invite, settings, block
select tests.authenticate_as('owner');
select results_eq($$ select count(*)::int from public.channels $$, $$ values (4) $$, 'owner reads every channel');
select lives_ok($$ insert into public.channel_members values
  ('e0000000-0000-4000-8000-000000000004', tests.get_supabase_uid('member')) $$, 'owner invites member to private channel');
select lives_ok($$ insert into public.community_settings (community_id, dms_enabled)
  values ('c0000000-0000-4000-8000-000000000001', false) $$, 'owner turns DMs off');

select tests.authenticate_as('member');
select results_eq($$ select count(*)::int from public.channels where title = 'Secret' $$, $$ values (1) $$,
  'invited member reads private channel');
select throws_ok($$ insert into public.messages (thread_id, author_id, body)
  values ('d1000000-0000-4000-8000-000000000001', auth.uid(), 'x') $$, '42501', null, 'DMs off: no sending');

select tests.authenticate_as_service_role();
update public.community_settings set dms_enabled = true;
insert into public.blocks values
  ('c0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('owner'), tests.get_supabase_uid('member'));
select tests.authenticate_as('member');
select throws_ok($$ insert into public.messages (thread_id, author_id, body)
  values ('d1000000-0000-4000-8000-000000000001', auth.uid(), 'x') $$, '42501', null, 'blocked: no sending');

select * from finish(true);
rollback;
