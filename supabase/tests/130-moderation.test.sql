-- Launch 6 item 3: channel moderators (scoped to their channels) and the reports queue.
begin;
select plan(23);

do $$
declare
  s uuid := '13131313-1313-4313-8313-131313131313';
  comm uuid := 'c1300000-0000-4000-8000-000000000001';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('mod');
  perform tests.create_supabase_user('student');
  perform tests.create_supabase_user('stranger');
  insert into public.spaces (id, slug, name, status) values (s, 'sqltest-moderation', 'SQL test', 'live');
  insert into public.space_members values (s, tests.get_supabase_uid('owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('owner'), 'Owner'),
    (s, tests.get_supabase_uid('mod'), 'Mod'),
    (s, tests.get_supabase_uid('student'), 'Student');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, s, 'community', 'community', 'Community', 'published');
  insert into public.grants (product_id, profile_id, source) values
    (comm, tests.get_supabase_uid('mod'), 'manual'),
    (comm, tests.get_supabase_uid('student'), 'manual');
  insert into public.channels (id, community_id, title, kind, position) values
    ('e1300000-0000-4000-8000-000000000001', comm, 'Feed A', 'feed', 0),
    ('e1300000-0000-4000-8000-000000000002', comm, 'Feed B', 'feed', 1),
    ('e1300000-0000-4000-8000-000000000003', comm, 'Chat A', 'chat', 2),
    ('e1300000-0000-4000-8000-000000000004', comm, 'Chat B', 'chat', 3);
  insert into public.posts (id, channel_id, author_id, body) values
    ('f1300000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001', tests.get_supabase_uid('student'), 'a'),
    ('f1300000-0000-4000-8000-000000000002', 'e1300000-0000-4000-8000-000000000002', tests.get_supabase_uid('student'), 'b'),
    ('f1300000-0000-4000-8000-000000000003', 'e1300000-0000-4000-8000-000000000001', tests.get_supabase_uid('student'), 'c');
  insert into public.comments (id, space_id, target_type, target_id, author_id, body) values
    ('f1310000-0000-4000-8000-000000000001', s, 'post', 'f1300000-0000-4000-8000-000000000001',
     tests.get_supabase_uid('student'), 'comment');
  insert into public.messages (id, channel_id, author_id, body) values
    ('f1320000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000003', tests.get_supabase_uid('student'), 'm a'),
    ('f1320000-0000-4000-8000-000000000002', 'e1300000-0000-4000-8000-000000000004', tests.get_supabase_uid('student'), 'm b');
end $$;

-- Owner picks the moderator
select tests.authenticate_as('owner');
select lives_ok($$ insert into public.channel_moderators values
  ('e1300000-0000-4000-8000-000000000001', tests.get_supabase_uid('mod')),
  ('e1300000-0000-4000-8000-000000000003', tests.get_supabase_uid('mod')) $$, 'owner picks a channel moderator');
select throws_ok($$ insert into public.channel_moderators values
  ('e1300000-0000-4000-8000-000000000002', tests.get_supabase_uid('stranger')) $$,
  '42501', null, 'moderator must be a community member');

-- Moderator acts in own channels only
select tests.authenticate_as('mod');
update public.posts set hidden_at = now()
  where id in ('f1300000-0000-4000-8000-000000000001', 'f1300000-0000-4000-8000-000000000002');
select results_eq($$ select id from public.posts where hidden_at is not null
  and id in ('f1300000-0000-4000-8000-000000000001', 'f1300000-0000-4000-8000-000000000002') $$,
  $$ values ('f1300000-0000-4000-8000-000000000001'::uuid) $$, 'moderator hides posts in own channel only, and reads them');
update public.comments set hidden_at = now() where id = 'f1310000-0000-4000-8000-000000000001';
select results_eq($$ select count(*)::int from public.comments
  where id = 'f1310000-0000-4000-8000-000000000001' and hidden_at is not null $$, $$ values (1) $$,
  'moderator hides comments in own channel');
delete from public.messages
  where id in ('f1320000-0000-4000-8000-000000000001', 'f1320000-0000-4000-8000-000000000002');
select results_eq($$ select id from public.messages
  where id in ('f1320000-0000-4000-8000-000000000001', 'f1320000-0000-4000-8000-000000000002') $$,
  $$ values ('f1320000-0000-4000-8000-000000000002'::uuid) $$, 'moderator deletes chat lines in own channel only');
select throws_ok($$ insert into public.channel_moderators values
  ('e1300000-0000-4000-8000-000000000002', auth.uid()) $$, '42501', null, 'moderator cannot pick moderators');
select results_eq($$ select count(*)::int from public.channel_moderators
  where channel_id = 'e1300000-0000-4000-8000-000000000001' $$, $$ values (1) $$, 'moderator sees own row');

-- Student reports
select tests.authenticate_as('student');
select is_empty($$ select 1 from public.posts where id = 'f1300000-0000-4000-8000-000000000001' $$,
  'student does not read the hidden post');
select is_empty($$ select 1 from public.channel_moderators
  where channel_id = 'e1300000-0000-4000-8000-000000000001' $$, 'student does not list moderators');
select lives_ok($$ insert into public.reports (target_type, target_id, reporter_id, reason)
  values ('post', 'f1300000-0000-4000-8000-000000000002', auth.uid(), 'spam') $$, 'student reports a post');
select throws_ok($$ insert into public.reports (target_type, target_id, reporter_id)
  values ('post', 'f1300000-0000-4000-8000-000000000002', auth.uid()) $$, '23505', null, 'one report per target');
select throws_ok($$ insert into public.reports (target_type, target_id, reporter_id, reason)
  values ('post', 'f1300000-0000-4000-8000-000000000003', auth.uid(), repeat('x', 501)) $$,
  '23514', null, 'reason length limited');
select lives_ok($$ insert into public.reports (target_type, target_id, reporter_id)
  values ('post', 'f1300000-0000-4000-8000-000000000003', auth.uid()) $$, 'student reports a post in feed A');
select lives_ok($$ insert into public.reports (target_type, target_id, reporter_id)
  values ('message', 'f1320000-0000-4000-8000-000000000002', auth.uid()) $$, 'student reports a chat line');
select throws_ok($$ insert into public.reports (target_type, target_id, reporter_id)
  values ('post', 'f1300000-0000-4000-8000-000000000001', auth.uid()) $$, '42501', null, 'cannot report unreadable content');
select throws_ok($$ insert into public.reports (target_type, target_id, reporter_id)
  values ('post', 'f13fffff-0000-4000-8000-000000000001', auth.uid()) $$, '23503', null, 'missing target refused');
select is_empty($$ select id from public.reports where community_id = 'c1300000-0000-4000-8000-000000000001' $$,
  'student sees no reports');

select tests.authenticate_as('stranger');
select throws_ok($$ insert into public.reports (target_type, target_id, reporter_id)
  values ('post', 'f1300000-0000-4000-8000-000000000002', auth.uid()) $$, '42501', null, 'stranger cannot report');

-- Moderator queue: own channels, no reporter
select tests.authenticate_as('mod');
select results_eq($$ select target_id from public.reports where community_id = 'c1300000-0000-4000-8000-000000000001' $$,
  $$ values ('f1300000-0000-4000-8000-000000000003'::uuid) $$, 'moderator sees reports in own channels');
select throws_ok($$ select reporter_id from public.reports $$, '42501', null, 'reporter hidden from moderator');
update public.reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
  where community_id = 'c1300000-0000-4000-8000-000000000001';
select is_empty($$ select * from public.report_reporters('c1300000-0000-4000-8000-000000000001') $$,
  'moderator gets no reporter names');

-- Owner: all reports, reporters, resolved kept
select tests.authenticate_as('owner');
select results_eq($$ select status, resolved_by = tests.get_supabase_uid('mod') from public.reports
  where community_id = 'c1300000-0000-4000-8000-000000000001' order by status, target_type $$,
  $$ values ('dismissed'::text, true), ('open'::text, null::boolean), ('open'::text, null::boolean) $$,
  'moderator resolved own channel report only, signed');
select results_eq($$ select count(*)::int from public.report_reporters('c1300000-0000-4000-8000-000000000001') $$,
  $$ values (3) $$, 'owner sees who reported');

select * from finish(true);
rollback;
