-- Launch 6 item 3 follow-up: post approval, post lock, review tabs, moderation log, report notifications.
begin;
select plan(31);

do $$
declare
  s uuid := '28282828-2828-4828-8828-282828282828';
  comm uuid := 'c2800000-0000-4000-8000-000000000001';
begin
  perform tests.create_supabase_user('owner280');
  perform tests.create_supabase_user('mod280');
  perform tests.create_supabase_user('student280');
  perform tests.create_supabase_user('other280');
  perform tests.create_supabase_user('stranger280');
  insert into public.spaces (id, slug, name, status) values (s, 'sqltest-moderation-review', 'SQL test', 'live');
  insert into public.space_members values (s, tests.get_supabase_uid('owner280'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('owner280'), 'Owner'),
    (s, tests.get_supabase_uid('mod280'), 'Mod'),
    (s, tests.get_supabase_uid('student280'), 'Student'),
    (s, tests.get_supabase_uid('other280'), 'Other');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, s, 'community', 'community', 'Community', 'published');
  insert into public.grants (product_id, profile_id, source) values
    (comm, tests.get_supabase_uid('mod280'), 'manual'),
    (comm, tests.get_supabase_uid('student280'), 'manual'),
    (comm, tests.get_supabase_uid('other280'), 'manual');
  insert into public.channels (id, community_id, title, kind, position) values
    ('e2800000-0000-4000-8000-000000000001', comm, 'Feed A', 'feed', 0),
    ('e2800000-0000-4000-8000-000000000002', comm, 'Feed B', 'feed', 1);
  insert into public.channel_moderators values ('e2800000-0000-4000-8000-000000000001', tests.get_supabase_uid('mod280'));
  insert into public.posts (id, channel_id, author_id, body) values
    ('f2800000-0000-4000-8000-000000000001', 'e2800000-0000-4000-8000-000000000001', tests.get_supabase_uid('other280'), 'open'),
    ('f2800000-0000-4000-8000-000000000002', 'e2800000-0000-4000-8000-000000000002', tests.get_supabase_uid('other280'), 'feed b');
end $$;

-- Approval list: staff with community.moderate pick members
select tests.authenticate_as('owner280');
select lives_ok($$ insert into public.post_approval_members values
  ('c2800000-0000-4000-8000-000000000001', tests.get_supabase_uid('student280')) $$, 'owner puts a member on approval');
select throws_ok($$ insert into public.post_approval_members values
  ('c2800000-0000-4000-8000-000000000001', tests.get_supabase_uid('stranger280')) $$,
  '42501', null, 'approval needs a community member');

select tests.authenticate_as('mod280');
select throws_ok($$ insert into public.post_approval_members values
  ('c2800000-0000-4000-8000-000000000001', tests.get_supabase_uid('other280')) $$,
  '42501', null, 'channel moderator cannot set approval');

-- Approval member posts go pending
select tests.authenticate_as('student280');
select results_eq($$ select count(*)::int from public.post_approval_members
  where community_id = 'c2800000-0000-4000-8000-000000000001' $$, $$ values (1) $$, 'member reads own approval row');
insert into public.posts (id, channel_id, author_id, body, status) values
  ('f2810000-0000-4000-8000-000000000001', 'e2800000-0000-4000-8000-000000000001', auth.uid(), 'pending 1', 'published'),
  ('f2810000-0000-4000-8000-000000000002', 'e2800000-0000-4000-8000-000000000001', auth.uid(), 'pending 2', 'published');
select results_eq($$ select status from public.posts where id = 'f2810000-0000-4000-8000-000000000001' $$,
  $$ values ('pending'::text) $$, 'approval member post is pending, whatever the caller sends');
update public.posts set status = 'published' where id = 'f2810000-0000-4000-8000-000000000001';
select results_eq($$ select status from public.posts where id = 'f2810000-0000-4000-8000-000000000001' $$,
  $$ values ('pending'::text) $$, 'author cannot publish own pending post');

select tests.authenticate_as('other280');
insert into public.posts (id, channel_id, author_id, body, status) values
  ('f2810000-0000-4000-8000-000000000003', 'e2800000-0000-4000-8000-000000000001', auth.uid(), 'mine', 'pending');
select results_eq($$ select status from public.posts where id = 'f2810000-0000-4000-8000-000000000003' $$,
  $$ values ('published'::text) $$, 'other member post publishes');
select is_empty($$ select 1 from public.posts where id in
  ('f2810000-0000-4000-8000-000000000001', 'f2810000-0000-4000-8000-000000000002') $$, 'pending posts hidden from members');

-- Moderator reviews
select tests.authenticate_as('mod280');
select results_eq($$ select count(*)::int from public.posts where status = 'pending' and id in
  ('f2810000-0000-4000-8000-000000000001', 'f2810000-0000-4000-8000-000000000002') $$, $$ values (2) $$,
  'moderator reads pending posts');
update public.posts set status = 'published' where id = 'f2810000-0000-4000-8000-000000000001';
update public.posts set status = 'rejected' where id = 'f2810000-0000-4000-8000-000000000002';
select throws_ok($$ update public.posts set status = 'draft' where id = 'f2810000-0000-4000-8000-000000000002' $$,
  '23514', null, 'status values checked');

select tests.authenticate_as('other280');
select results_eq($$ select id from public.posts where id in
  ('f2810000-0000-4000-8000-000000000001', 'f2810000-0000-4000-8000-000000000002') $$,
  $$ values ('f2810000-0000-4000-8000-000000000001'::uuid) $$, 'approved post shows, rejected does not');
select throws_ok($$ insert into public.comments (space_id, target_type, target_id, author_id, body) values
  ('28282828-2828-4828-8828-282828282828', 'post', 'f2810000-0000-4000-8000-000000000002', auth.uid(), 'hi') $$,
  '42501', null, 'no comment on a rejected post');

select tests.authenticate_as('student280');
select results_eq($$ select status from public.posts where id = 'f2810000-0000-4000-8000-000000000002' $$,
  $$ values ('rejected'::text) $$, 'author still reads own rejected post');

-- Lock
select tests.authenticate_as('mod280');
update public.posts set locked_at = now() where id in
  ('f2800000-0000-4000-8000-000000000001', 'f2800000-0000-4000-8000-000000000002');
select results_eq($$ select count(*)::int from public.posts where locked_at is not null and id in
  ('f2800000-0000-4000-8000-000000000001', 'f2800000-0000-4000-8000-000000000002') $$, $$ values (1) $$,
  'moderator locks in own channel only');
select throws_ok($$ insert into public.comments (space_id, target_type, target_id, author_id, body) values
  ('28282828-2828-4828-8828-282828282828', 'post', 'f2800000-0000-4000-8000-000000000001', auth.uid(), 'hi') $$,
  '42501', null, 'moderator cannot comment on a locked post either');

select tests.authenticate_as('other280');
select results_eq($$ select count(*)::int from public.posts where id = 'f2800000-0000-4000-8000-000000000001' $$,
  $$ values (1) $$, 'locked post stays visible');
select throws_ok($$ insert into public.comments (space_id, target_type, target_id, author_id, body) values
  ('28282828-2828-4828-8828-282828282828', 'post', 'f2800000-0000-4000-8000-000000000001', auth.uid(), 'hi') $$,
  '42501', null, 'no comment on a locked post');
select lives_ok($$ insert into public.comments (space_id, target_type, target_id, author_id, body) values
  ('28282828-2828-4828-8828-282828282828', 'post', 'f2810000-0000-4000-8000-000000000001', auth.uid(), 'hi') $$,
  'comment on an open post');
select throws_ok($$ insert into public.posts (channel_id, author_id, body, locked_at) values
  ('e2800000-0000-4000-8000-000000000001', auth.uid(), 'x', now()) $$, '42501', null, 'members cannot post locked');

-- Moderation log
select tests.authenticate_as('mod280');
select lives_ok($$ insert into public.moderation_log (actor_id, action, target_type, target_id) values
  (auth.uid(), 'lock', 'post', 'f2800000-0000-4000-8000-000000000001') $$, 'moderator logs an action');
select throws_ok($$ insert into public.moderation_log (actor_id, action, target_type, target_id) values
  (auth.uid(), 'lock', 'post', 'f2800000-0000-4000-8000-000000000002') $$, '42501', null, 'not in another channel');
select throws_ok($$ insert into public.moderation_log (actor_id, action, target_type, target_id) values
  (auth.uid(), 'lock', 'post', 'f28fffff-0000-4000-8000-000000000001') $$, '23503', null, 'missing target refused');
select throws_ok($$ insert into public.moderation_log (actor_id, action, target_type, target_id) values
  (auth.uid(), 'delete', 'post', 'f2800000-0000-4000-8000-000000000001') $$, '23514', null, 'action values checked');
select results_eq($$ select community_id, channel_id from public.moderation_log
  where target_id = 'f2800000-0000-4000-8000-000000000001' $$,
  $$ values ('c2800000-0000-4000-8000-000000000001'::uuid, 'e2800000-0000-4000-8000-000000000001'::uuid) $$,
  'log row takes channel and community from the target');

select tests.authenticate_as('other280');
select throws_ok($$ insert into public.moderation_log (actor_id, action, target_type, target_id) values
  (auth.uid(), 'hide', 'post', 'f2810000-0000-4000-8000-000000000003') $$, '42501', null, 'member cannot log');
select is_empty($$ select 1 from public.moderation_log where community_id = 'c2800000-0000-4000-8000-000000000001' $$,
  'member reads no log');

select tests.authenticate_as('owner280');
select results_eq($$ select count(*)::int from public.moderation_log
  where community_id = 'c2800000-0000-4000-8000-000000000001' $$, $$ values (1) $$, 'owner reads the log');

-- Report hides; moderators get a notification
select tests.authenticate_as('other280');
insert into public.reports (target_type, target_id, reporter_id)
  values ('post', 'f2810000-0000-4000-8000-000000000001', auth.uid());
select lives_ok($$ insert into public.notifications (space_id, recipient_id, actor_id, type, community_id) values
  ('28282828-2828-4828-8828-282828282828', tests.get_supabase_uid('mod280'), auth.uid(), 'report',
   'c2800000-0000-4000-8000-000000000001') $$, 'reporter notifies a moderator');
select throws_ok($$ insert into public.notifications (space_id, recipient_id, actor_id, type, community_id) values
  ('28282828-2828-4828-8828-282828282828', tests.get_supabase_uid('mod280'), auth.uid(), 'reaction',
   'c2800000-0000-4000-8000-000000000001') $$, '23514', null, 'only report notifications name a community');

select tests.authenticate_as('student280');
select throws_ok($$ insert into public.notifications (space_id, recipient_id, actor_id, type, community_id) values
  ('28282828-2828-4828-8828-282828282828', tests.get_supabase_uid('mod280'), auth.uid(), 'report',
   'c2800000-0000-4000-8000-000000000001') $$, '42501', null, 'no report notification without a report');

select tests.authenticate_as('mod280');
update public.reports set status = 'hidden', resolved_by = auth.uid(), resolved_at = now()
  where target_id = 'f2810000-0000-4000-8000-000000000001';
select results_eq($$ select status from public.reports where target_id = 'f2810000-0000-4000-8000-000000000001' $$,
  $$ values ('hidden'::text) $$, 'report resolves as hidden');

select * from finish(true);
rollback;
