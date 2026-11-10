-- Community: staff reach (ticks), member read, read-only channels, hidden posts, comment
-- shape, step comments, polymorphic cleanup, reactions, notification privacy.
begin;
select plan(24);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  comm uuid := 'c0000000-0000-4000-8000-000000000001';
  prog uuid := 'a0000000-0000-4000-8000-000000000001';
  modl uuid := 'b0000000-0000-4000-8000-000000000001';
  stp uuid := 'd0000000-0000-4000-8000-000000000001';
  general uuid := 'e0000000-0000-4000-8000-000000000001';
  news uuid := 'e0000000-0000-4000-8000-000000000002';
  post uuid := 'f0000000-0000-4000-8000-000000000001';
  hidden uuid := 'f0000000-0000-4000-8000-000000000002';
  top uuid := '90000000-0000-4000-8000-000000000001';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('assistant');
  perform tests.create_supabase_user('member');
  perform tests.create_supabase_user('stranger');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live');
  insert into public.space_members values
    (a, tests.get_supabase_uid('owner'), 'owner', now()),
    (a, tests.get_supabase_uid('assistant'), 'assistant', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (a, tests.get_supabase_uid('owner'), 'Owner'),
    (a, tests.get_supabase_uid('member'), 'Member');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, a, 'community', 'community', 'Community', 'published'),
    (prog, a, 'program', 'rope-1', 'Rope 1', 'published');
  insert into public.programs (product_id) values (prog);
  insert into public.modules (id, program_id, title, status) values (modl, prog, 'M', 'published');
  insert into public.steps (id, module_id, title, status) values (stp, modl, 'Intro', 'published');
  insert into public.grants (product_id, profile_id, source) values
    (comm, tests.get_supabase_uid('member'), 'manual'),
    (prog, tests.get_supabase_uid('member'), 'manual');
  insert into public.channels (id, community_id, title, read_only, position) values
    (general, comm, 'General', false, 0),
    (news, comm, 'News', true, 1);
  insert into public.posts (id, channel_id, author_id, body) values
    (post, general, tests.get_supabase_uid('member'), 'hello');
  insert into public.posts (id, channel_id, author_id, body, hidden_at) values
    (hidden, general, tests.get_supabase_uid('member'), 'spam', now());
  insert into public.comments (id, space_id, target_type, target_id, author_id, body) values
    (top, a, 'post', post, tests.get_supabase_uid('owner'), 'welcome');
  insert into public.reactions (target_type, target_id, profile_id, emoji) values
    ('comment', top, tests.get_supabase_uid('member'), '👍');
end $$;

-- Shape guards
select throws_ok($$ insert into public.channels (community_id, title)
  values ('a0000000-0000-4000-8000-000000000001', 'X') $$, '23514', null, 'channels only on community products');
select throws_ok($$ insert into public.reactions (target_type, target_id, profile_id, emoji)
  values ('post', 'f0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('owner'), '💩') $$, '23514', null, 'emoji outside the set refused');
select throws_ok($$ insert into public.comments (space_id, target_type, target_id, parent_id, author_id, body)
  values ('11111111-1111-4111-8111-111111111111', 'step', 'd0000000-0000-4000-8000-000000000001',
          '90000000-0000-4000-8000-000000000001', tests.get_supabase_uid('owner'), 'x') $$,
  '23514', null, 'reply must be on the parent target');

-- Member
select tests.authenticate_as('member');
select results_eq($$ select title from public.channels order by position $$, $$ values ('General'), ('News') $$, 'member reads channels');
select results_eq($$ select body from public.posts $$, $$ values ('hello') $$, 'member does not see hidden posts');
select lives_ok($$ insert into public.posts (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000001', auth.uid(), 'mine') $$, 'member posts in public channel');
select throws_ok($$ insert into public.posts (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000002', auth.uid(), 'no') $$, '42501', null, 'member cannot post in read-only channel');
select throws_ok($$ insert into public.posts (channel_id, author_id, body, pinned)
  values ('e0000000-0000-4000-8000-000000000001', auth.uid(), 'pin', true) $$, '42501', null, 'member cannot self-pin');
select lives_ok($$ insert into public.comments (space_id, target_type, target_id, parent_id, author_id, body)
  values ('11111111-1111-4111-8111-111111111111', 'post', 'f0000000-0000-4000-8000-000000000001',
          '90000000-0000-4000-8000-000000000001', auth.uid(), 'thanks') $$, 'member replies');
select lives_ok($$ insert into public.comments (space_id, target_type, target_id, author_id, body)
  values ('11111111-1111-4111-8111-111111111111', 'step', 'd0000000-0000-4000-8000-000000000001', auth.uid(), 'q') $$,
  'member comments on an open step');
select throws_ok($$ insert into public.comments (space_id, target_type, target_id, author_id, body)
  values ('22222222-2222-4222-8222-222222222222', 'post', 'f0000000-0000-4000-8000-000000000001', auth.uid(), 'x') $$,
  null, null, 'comment space must match its target');
select lives_ok($$ insert into public.notifications (space_id, recipient_id, actor_id, type, post_id)
  values ('11111111-1111-4111-8111-111111111111', tests.get_supabase_uid('owner'), auth.uid(), 'comment',
          'f0000000-0000-4000-8000-000000000001') $$, 'actor notifies a space profile');
select throws_ok($$ insert into public.notifications (space_id, recipient_id, actor_id, type)
  values ('11111111-1111-4111-8111-111111111111', tests.get_supabase_uid('owner'), tests.get_supabase_uid('owner'), 'mention') $$,
  '42501', null, 'cannot forge another actor');
select is_empty($$ select 1 from public.notifications $$, 'member reads no one else''s notifications');

-- Stranger (no grant)
select tests.authenticate_as('stranger');
select is_empty($$ select 1 from public.channels $$, 'stranger reads no channels');
select is_empty($$ select 1 from public.comments $$, 'stranger reads no comments');

-- Assistant: not ticked, then ticked
select tests.authenticate_as('assistant');
select is_empty($$ select 1 from public.posts $$, 'unticked assistant does not reach the community');

select tests.authenticate_as('owner');
select lives_ok($$ insert into public.space_member_communities values
  ('c0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('assistant')) $$, 'owner ticks assistant');
select results_eq($$ select count(*)::int from public.notifications $$, $$ values (1) $$, 'owner reads own notification');
select lives_ok($$ update public.notifications set read_at = now() $$, 'owner marks read');

select tests.authenticate_as('assistant');
select results_eq($$ select count(*)::int from public.posts $$, $$ values (3) $$, 'ticked assistant moderates: sees hidden posts');
select lives_ok($$ insert into public.posts (channel_id, author_id, body)
  values ('e0000000-0000-4000-8000-000000000002', auth.uid(), 'news') $$, 'moderator posts in read-only channel');

-- Polymorphic cleanup
select tests.authenticate_as_service_role();
delete from public.posts where id = 'f0000000-0000-4000-8000-000000000001';
select is_empty($$ select 1 from public.comments where target_type = 'post' and target_id = 'f0000000-0000-4000-8000-000000000001' $$,
  'deleting a post deletes its comments');
select is_empty($$ select 1 from public.reactions where target_id = '90000000-0000-4000-8000-000000000001' $$,
  'and reactions on those comments');

select * from finish(true);
rollback;
