-- Launch 3: points (award, dedupe, cleanup), leaderboard gating, challenges (window, one entry,
-- entries private to author + staff), meetups (hidden join link, RSVP).
-- now() is fixed for the whole transaction, so windows are set relative to it.
begin;
select plan(32);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  comm uuid := 'c0000000-0000-4000-8000-000000000001';
  vip uuid := '70000000-0000-4000-8000-000000000001';
  general uuid := 'e0000000-0000-4000-8000-000000000001';
  owner_post uuid := 'b0000000-0000-4000-8000-000000000001';
  member_post uuid := 'b0000000-0000-4000-8000-000000000002';
  members uuid;
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('member');
  perform tests.create_supabase_user('other');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live');
  insert into public.space_members values (a, tests.get_supabase_uid('owner'), 'owner', now());
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, a, 'community', 'community', 'Community', 'published');
  select id into members from public.access_groups where community_id = comm and is_default;
  insert into public.access_groups (id, community_id, title) values (vip, comm, 'VIP');
  insert into public.grants (product_id, profile_id, source) values
    (comm, tests.get_supabase_uid('member'), 'manual'),
    (comm, tests.get_supabase_uid('other'), 'manual');
  insert into public.channels (id, community_id, title, kind, position) values (general, comm, 'General', 'feed', 0);
  insert into public.posts (id, channel_id, author_id, body) values
    (owner_post, general, tests.get_supabase_uid('owner'), 'Owner post'),
    (member_post, general, tests.get_supabase_uid('member'), 'Member post');
  insert into public.challenges (id, community_id, access_group_id, title, starts_at, ends_at) values
    ('f0000000-0000-4000-8000-000000000001', comm, members, 'Open', now() - interval '1 hour', now() + interval '1 day'),
    ('f0000000-0000-4000-8000-000000000002', comm, members, 'Hidden', now() + interval '1 day', now() + interval '2 days'),
    ('f0000000-0000-4000-8000-000000000003', comm, vip, 'VIP only', now() - interval '1 hour', now() + interval '1 day');
  insert into public.meetups (id, community_id, access_group_id, title, location, time_zone, starts_at, ends_at) values
    ('f1000000-0000-4000-8000-000000000001', comm, members, 'Q&A', 'https://zoom.us/j/1', 'Europe/Berlin',
     now() + interval '1 day', now() + interval '1 day 1 hour'),
    ('f1000000-0000-4000-8000-000000000002', comm, members, 'Live now', 'https://zoom.us/j/2', 'UTC',
     now() + interval '10 minutes', now() + interval '2 hours');
end $$;

-- Shape guards
select throws_ok($$ insert into public.challenges (community_id, access_group_id, title, starts_at, ends_at)
  values ('c0000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'x', now(), now()) $$,
  '23514', null, 'challenge must end after it starts');
select throws_ok($$ insert into public.meetups (community_id, access_group_id, title, location, starts_at, ends_at)
  values ('c0000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'x', 'http://zoom.us',
          now(), now() + interval '1 hour') $$, '23514', null, 'meetup link must be https');
select throws_ok($$ insert into public.meetups (community_id, access_group_id, title, location, time_zone, starts_at, ends_at)
  values ('c0000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'x', 'https://zoom.us',
          'Mars/Base', now(), now() + interval '1 hour') $$, '23514', null, 'meetup zone must be a real IANA zone');
select throws_ok($$ insert into public.community_settings (community_id, point_values)
  values ('c0000000-0000-4000-8000-000000000001', '{"comment": 1001}') $$, '23514', null, 'point value above 1000 refused');
select throws_ok($$ insert into public.community_settings (community_id, point_values)
  values ('c0000000-0000-4000-8000-000000000001', '{"bogus": 1}') $$, '23514', null, 'unknown point reason refused');

-- Points: comment, reactions (dedupe per post, never on own post), cleanup
insert into public.comments (space_id, target_type, target_id, author_id, body) values
  ('11111111-1111-4111-8111-111111111111', 'post', 'b0000000-0000-4000-8000-000000000001',
   tests.get_supabase_uid('member'), 'Nice');
insert into public.reactions (target_type, target_id, profile_id, emoji) values
  ('post', 'b0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('member'), '👍'),
  ('post', 'b0000000-0000-4000-8000-000000000001', tests.get_supabase_uid('member'), '🔥'),
  ('post', 'b0000000-0000-4000-8000-000000000002', tests.get_supabase_uid('member'), '👍');
select results_eq($$ select reason, points from public.points_ledger
  where profile_id = tests.get_supabase_uid('member') order by reason $$,
  $$ values ('comment', 3), ('reaction_given', 1) $$, 'member earns comment + one reaction_given, nothing on own post');
select results_eq($$ select reason, points from public.points_ledger where profile_id = tests.get_supabase_uid('owner') $$,
  $$ values ('reaction_received', 1) $$, 'post author earns reaction_received once');
delete from public.reactions where emoji = '👍' and target_id = 'b0000000-0000-4000-8000-000000000001';
select results_eq($$ select count(*)::int from public.points_ledger where reason like 'reaction%' $$, $$ values (2) $$,
  'reaction points stay while another emoji remains');
delete from public.reactions where target_id = 'b0000000-0000-4000-8000-000000000001';
select is_empty($$ select 1 from public.points_ledger where reason like 'reaction%' $$, 'reaction points go with the last emoji');
delete from public.comments;
select is_empty($$ select 1 from public.points_ledger $$, 'comment points go with the comment');

insert into public.community_settings (community_id, points_enabled) values ('c0000000-0000-4000-8000-000000000001', false);
insert into public.comments (space_id, target_type, target_id, author_id, body) values
  ('11111111-1111-4111-8111-111111111111', 'post', 'b0000000-0000-4000-8000-000000000001',
   tests.get_supabase_uid('member'), 'Off');
select is_empty($$ select 1 from public.points_ledger $$, 'nothing earned while points are off');
update public.community_settings set points_enabled = true, point_values = '{"comment": 5}';
insert into public.comments (space_id, target_type, target_id, author_id, body) values
  ('11111111-1111-4111-8111-111111111111', 'post', 'b0000000-0000-4000-8000-000000000001',
   tests.get_supabase_uid('other'), 'On');
select results_eq($$ select points from public.points_ledger $$, $$ values (5) $$, 'override value applies');

-- Challenges as member
select tests.authenticate_as('member');
select results_eq($$ select title from public.challenges order by title $$, $$ values ('Open') $$,
  'member sees started challenges of own group only');
select lives_ok($$ insert into public.challenge_entries (challenge_id, profile_id, body)
  values ('f0000000-0000-4000-8000-000000000001', auth.uid(), 'Done') $$, 'member enters an open challenge');
select throws_ok($$ insert into public.challenge_entries (challenge_id, profile_id, body)
  values ('f0000000-0000-4000-8000-000000000001', auth.uid(), 'Again') $$, '23505', null, 'one entry per member');
select throws_ok($$ insert into public.challenge_entries (challenge_id, profile_id, body)
  values ('f0000000-0000-4000-8000-000000000003', auth.uid(), 'x') $$, '42501', null, 'no entry in another group');
select results_eq($$ select public.challenge_entry_count('f0000000-0000-4000-8000-000000000001') $$, $$ values (1) $$,
  'member reads the entry count');
select results_eq($$ select points from public.points_ledger where reason = 'challenge' $$, $$ values (100) $$,
  'entry earns challenge points');

select tests.authenticate_as('other');
select lives_ok($$ insert into public.challenge_entries (challenge_id, profile_id, body)
  values ('f0000000-0000-4000-8000-000000000001', auth.uid(), 'Mine') $$, 'other member enters too');
select results_eq($$ select body from public.challenge_entries $$, $$ values ('Mine') $$, 'members read only their own entry');

select tests.authenticate_as('owner');
select results_eq($$ select count(*)::int from public.challenge_entries $$, $$ values (2) $$, 'staff read every entry');
select results_eq($$ select count(*)::int from public.challenges $$, $$ values (3) $$, 'staff see every challenge');

-- Meetups
select tests.authenticate_as('member');
select throws_ok($$ select location from public.meetups $$, '42501', null, 'join link column is not selectable');
select results_eq($$ select public.meetup_join_url('f1000000-0000-4000-8000-000000000001') $$, $$ values (null::text) $$,
  'no join link a day before');
select results_eq($$ select public.meetup_join_url('f1000000-0000-4000-8000-000000000002') $$,
  $$ values ('https://zoom.us/j/2') $$, 'join link from 15 minutes before');
select lives_ok($$ insert into public.meetup_rsvps (meetup_id, profile_id)
  values ('f1000000-0000-4000-8000-000000000001', auth.uid()) $$, 'member RSVPs');
select results_eq($$ select public.meetup_rsvp_count('f1000000-0000-4000-8000-000000000001') $$, $$ values (1) $$,
  'member reads the RSVP count');

select tests.authenticate_as('owner');
select results_eq($$ select public.meetup_join_url('f1000000-0000-4000-8000-000000000001') $$,
  $$ values ('https://zoom.us/j/1') $$, 'staff read the join link any time');

-- Leaderboard gating
select tests.authenticate_as('member');
select results_eq($$ select count(*)::int from public.point_totals('c0000000-0000-4000-8000-000000000001', null) $$,
  $$ values (2) $$, 'members see the board by default');
select tests.authenticate_as_service_role();
update public.community_settings set leaderboard = 'staff';
select tests.authenticate_as('member');
select is_empty($$ select 1 from public.point_totals('c0000000-0000-4000-8000-000000000001', null) $$,
  'staff-only board is empty for members');
select results_eq($$ select count(*)::int from public.points_ledger $$, $$ values (1) $$,
  'members still read their own ledger rows');
select tests.authenticate_as('owner');
select results_eq($$ select count(*)::int from public.point_totals('c0000000-0000-4000-8000-000000000001', null) $$,
  $$ values (2) $$, 'staff see the staff-only board');

select * from finish(true);
rollback;
