-- Launch 4: coaching programs, scheduler rows, sessions (no overlap, client booking balance,
-- cutoff), visibility (own 1:1 + group of held products), staff-only notes, calendar token.
-- now() is fixed for the whole transaction, so times are set relative to it.
begin;
select plan(26);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  one uuid := 'c1000000-0000-4000-8000-000000000001';
  grp uuid := 'c1000000-0000-4000-8000-000000000002';
  prog uuid := 'c1000000-0000-4000-8000-000000000003';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('assistant');
  perform tests.create_supabase_user('member');
  perform tests.create_supabase_user('other');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live');
  insert into public.space_members values
    (a, tests.get_supabase_uid('owner'), 'owner', now()),
    (a, tests.get_supabase_uid('assistant'), 'assistant', now());
  insert into public.products (id, space_id, kind, slug, title, status) values
    (one, a, 'coaching', 'private', 'Private Coaching', 'published'),
    (grp, a, 'coaching', 'group', 'Group Coaching', 'published'),
    (prog, a, 'program', 'course', 'Course', 'published');
  insert into public.coaching_programs (product_id, kind, session_minutes, sessions_included, location) values
    (one, 'one_on_one', 60, 1, 'https://meet.example.test/a'),
    (grp, 'group', 90, 1, null);
  insert into public.coach_settings (space_id, time_zone, cancel_cutoff_hours) values (a, 'Europe/Berlin', 24);
  insert into public.grants (product_id, profile_id, source) values
    (one, tests.get_supabase_uid('member'), 'manual'),
    (grp, tests.get_supabase_uid('member'), 'manual'),
    (one, tests.get_supabase_uid('other'), 'manual');
  insert into public.coaching_sessions (id, product_id, space_id, client_id, title, starts_at, ends_at) values
    ('5e000000-0000-4000-8000-000000000001', grp, a, null, 'Group call', now() + interval '3 days', now() + interval '3 days 90 minutes'),
    ('5e000000-0000-4000-8000-000000000002', one, a, tests.get_supabase_uid('other'), 'Other 1:1',
     now() + interval '4 days', now() + interval '4 days 1 hour');
  insert into public.session_notes (session_id, body) values ('5e000000-0000-4000-8000-000000000002', 'private note');
end $$;

-- Shape guards
select throws_ok($$ insert into public.coaching_programs (product_id) values ('c1000000-0000-4000-8000-000000000003') $$,
  '23514', null, 'program settings only on coaching products');
select throws_ok($$ update public.coaching_programs set session_minutes = 10 $$, '23514', null, 'sessions are at least 15 minutes');
select throws_ok($$ update public.coaching_programs set location = 'http://x.test' $$, '23514', null, 'join link must be https');
select throws_ok($$ update public.coach_settings set time_zone = 'Mars/Base' $$, '23514', null, 'coach zone must be a real IANA zone');
select throws_ok($$ update public.coach_settings set window_days = 201 $$, '23514', null, 'booking window at most 200 days');
select throws_ok($$ insert into public.availability_rules (space_id, weekday, start_minute, end_minute)
  values ('11111111-1111-4111-8111-111111111111', 7, 540, 1020) $$, '23514', null, 'weekday 0..6');
select throws_ok($$ insert into public.availability_rules (space_id, weekday, start_minute, end_minute)
  values ('11111111-1111-4111-8111-111111111111', 1, 600, 600) $$, '23514', null, 'window must end after it starts');
select throws_ok($$ insert into public.availability_overrides (space_id, date, start_minute, end_minute)
  values ('11111111-1111-4111-8111-111111111111', '2026-12-24', 540, null) $$, '23514', null, 'override is a full window or a day off');
select throws_ok($$ insert into public.coaching_sessions (product_id, space_id, title, starts_at, ends_at)
  values ('c1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'x', now() + interval '5 days',
          now() + interval '5 days 1 hour') $$, '23514', null, 'sessions only on coaching products');

-- No overlap of scheduled sessions in a space; cancelled ones free the time.
select throws_ok($$ insert into public.coaching_sessions (product_id, space_id, title, starts_at, ends_at)
  values ('c1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Clash',
          now() + interval '3 days 30 minutes', now() + interval '3 days 2 hours') $$, '23P01', null, 'overlapping session refused');
select lives_ok($$ insert into public.coaching_sessions (product_id, space_id, title, starts_at, ends_at, status, cancelled_at)
  values ('c1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Old',
          now() + interval '3 days', now() + interval '3 days 1 hour', 'cancelled', now()) $$, 'cancelled sessions may overlap');

-- Visibility
select tests.authenticate_as('member');
select results_eq($$ select title from public.coaching_sessions where status = 'scheduled' order by starts_at $$,
  $$ values ('Group call'::text) $$, 'member sees the group session, not another client''s 1:1');
select is_empty($$ select 1 from public.session_notes $$, 'clients never read notes');
select is_empty($$ select 1 from public.calendar_connections $$, 'clients never read the calendar connection');
select results_eq($$ select count(*)::int from public.coaching_busy('11111111-1111-4111-8111-111111111111', now(), now() + interval '30 days') $$,
  $$ values (2) $$, 'busy time covers every scheduled session of the space');
select lives_ok($$ update public.coaching_sessions set title = 'hacked' $$, 'direct update runs (RLS filters it)');

-- Booking: balance, program length, kind
select throws_ok($$ select public.book_coaching_session('c1000000-0000-4000-8000-000000000002', now() + interval '5 days',
  now() + interval '5 days 90 minutes', '') $$, '23514', null, 'group programs are not self-booked');
select throws_ok($$ select public.book_coaching_session('c1000000-0000-4000-8000-000000000001', now() + interval '5 days',
  now() + interval '5 days 30 minutes', '') $$, '23514', null, 'booking must match the program length');
select is((public.book_coaching_session('c1000000-0000-4000-8000-000000000001', now() + interval '5 days',
  now() + interval '5 days 1 hour', ' knots ')).agenda, 'knots', 'member books a 1:1 session');
select throws_ok($$ select public.book_coaching_session('c1000000-0000-4000-8000-000000000001', now() + interval '6 days',
  now() + interval '6 days 1 hour', '') $$, '23514', null, 'no sessions left after the included one');

-- Changes: own sessions only, before the cutoff
select throws_ok($$ select public.change_coaching_session('5e000000-0000-4000-8000-000000000002', null) $$,
  '23503', null, 'cannot cancel another client''s session');
select is((public.change_coaching_session((select id from public.coaching_sessions where client_id = auth.uid()),
  now() + interval '7 days')).ends_at, now() + interval '7 days 1 hour', 'reschedule keeps the length');

select tests.authenticate_as('assistant');
select results_eq($$ select body from public.session_notes $$, $$ values ('private note'::text) $$, 'staff read notes');
select is_empty($$ select 1 from public.coaching_sessions where title = 'hacked' $$, 'client direct update changed nothing');

-- Calendar token: service role only, removed with the connection
select throws_ok($$ select public.calendar_token('11111111-1111-4111-8111-111111111111') $$, '42501', null,
  'staff cannot read the calendar token');
select tests.authenticate_as_service_role();
select public.save_calendar_connection('11111111-1111-4111-8111-111111111111', 'coach@test', 'primary', 'refresh-1');
select is(public.calendar_token('11111111-1111-4111-8111-111111111111'), 'refresh-1', 'service role reads the token');

select * from finish(true);
rollback;
