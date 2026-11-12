-- Launch 6 item 8: recurring meetups. Occurrences keep wall-clock time across DST, RSVPs and
-- join links are per occurrence, cancels drop RSVPs, staff edit one occurrence or split a series.
-- now() is fixed for the whole transaction, so windows are set relative to it.
begin;
select plan(28);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  comm uuid := 'c0000000-0000-4000-8000-000000000001';
  members uuid;
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('member');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live');
  insert into public.space_members values (a, tests.get_supabase_uid('owner'), 'owner', now());
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, a, 'community', 'community', 'Community', 'published');
  select id into members from public.access_groups where community_id = comm and is_default;
  insert into public.grants (product_id, profile_id, source) values (comm, tests.get_supabase_uid('member'), 'manual');
  insert into public.meetups (id, community_id, access_group_id, title, location, time_zone, starts_at, ends_at,
                              repeat_freq, repeat_every, repeat_days, repeat_count) values
    -- 19:00 Berlin weekly from Tuesday 2026-10-20 (summer time) and 2026-03-24 (winter time).
    ('f2000000-0000-4000-8000-000000000001', comm, members, 'Autumn', 'https://zoom.us/j/1', 'Europe/Berlin',
     '2026-10-20 17:00Z', '2026-10-20 18:00Z', 'weekly', 1, '{}', null),
    ('f2000000-0000-4000-8000-000000000002', comm, members, 'Spring', 'https://zoom.us/j/2', 'Europe/Berlin',
     '2026-03-24 18:00Z', '2026-03-24 19:00Z', 'weekly', 1, '{}', null),
    -- 18:00 Berlin on the 5th (= last) Thursday, monthly.
    ('f2000000-0000-4000-8000-000000000003', comm, members, 'Last Thursday', 'https://zoom.us/j/3', 'Europe/Berlin',
     '2026-10-29 17:00Z', '2026-10-29 18:00Z', 'monthly', 1, '{}', null),
    -- Daily, 5 times: occurrence 1 ended, 2 is live now, 3 is tomorrow.
    ('f2000000-0000-4000-8000-000000000004', comm, members, 'Daily', 'https://zoom.us/j/4', 'UTC',
     now() - interval '2 days 30 minutes', now() - interval '1 day 23 hours 30 minutes', 'daily', 1, '{}', 5);
  insert into public.meetup_rsvps (meetup_id, occurrence, profile_id) values
    ('f2000000-0000-4000-8000-000000000004', 1, tests.get_supabase_uid('member'));
end $$;

-- Shape guards
select throws_ok($$ update public.meetups set repeat_until = '2027-01-01'
  where id = 'f2000000-0000-4000-8000-000000000004' $$, '23514', null, 'count and until are not both set');
select throws_ok($$ update public.meetups set repeat_days = '{1}'
  where id = 'f2000000-0000-4000-8000-000000000004' $$, '23514', null, 'days only for weekly');
select throws_ok($$ update public.meetups set repeat_freq = 'yearly'
  where id = 'f2000000-0000-4000-8000-000000000004' $$, '23514', null, 'unknown repeat refused');

-- Occurrence times in the meetup zone
select is(public.meetup_occurrence_start(m, 1), '2026-10-27 18:00Z'::timestamptz, 'autumn: still 19:00 Berlin after DST ends')
  from public.meetups m where m.id = 'f2000000-0000-4000-8000-000000000001';
select is(public.meetup_occurrence_start(m, 1), '2026-03-31 17:00Z'::timestamptz, 'spring: still 19:00 Berlin after DST starts')
  from public.meetups m where m.id = 'f2000000-0000-4000-8000-000000000002';
select is(public.meetup_occurrence_start(m, 1), '2026-11-26 17:00Z'::timestamptz, 'monthly 5th Thursday = last Thursday')
  from public.meetups m where m.id = 'f2000000-0000-4000-8000-000000000003';
select is(public.meetup_occurrence_start(m, 5), null, 'no occurrence past the count')
  from public.meetups m where m.id = 'f2000000-0000-4000-8000-000000000004';
select is(public.zoned_to_utc('2026-10-25 02:30', 'Europe/Berlin'), '2026-10-25 00:30Z'::timestamptz,
  'repeated hour gives the earlier instant');
select is(public.zoned_to_utc('2026-03-29 02:30', 'Europe/Berlin'), '2026-03-29 01:30Z'::timestamptz,
  'skipped hour moves forward');

-- Members: RSVP and join link per occurrence
select tests.authenticate_as('member');
select lives_ok($$ insert into public.meetup_rsvps (meetup_id, occurrence, profile_id)
  values ('f2000000-0000-4000-8000-000000000004', 2, auth.uid()) $$, 'RSVP to the live occurrence');
select lives_ok($$ insert into public.meetup_rsvps (meetup_id, occurrence, profile_id)
  values ('f2000000-0000-4000-8000-000000000004', 3, auth.uid()) $$, 'RSVP to the next occurrence');
select throws_ok($$ insert into public.meetup_rsvps (meetup_id, occurrence, profile_id)
  values ('f2000000-0000-4000-8000-000000000004', 0, auth.uid()) $$, '42501', null, 'no RSVP to an ended occurrence');
select throws_ok($$ insert into public.meetup_rsvps (meetup_id, occurrence, profile_id)
  values ('f2000000-0000-4000-8000-000000000004', 5, auth.uid()) $$, '42501', null, 'no RSVP past the count');
select is(public.meetup_join_url('f2000000-0000-4000-8000-000000000004', 2), 'https://zoom.us/j/4', 'join link while live');
select is(public.meetup_join_url('f2000000-0000-4000-8000-000000000004', 3), null, 'no join link a day before');
select is(public.meetup_rsvp_count('f2000000-0000-4000-8000-000000000004', 2), 1, 'RSVP count per occurrence');
select throws_ok($$ insert into public.meetup_occurrences (meetup_id, occurrence, cancelled)
  values ('f2000000-0000-4000-8000-000000000004', 3, true) $$, '42501', null, 'members cannot cancel');
select throws_ok($$ select public.split_meetup('f2000000-0000-4000-8000-000000000004', 2) $$, '42501', null,
  'members cannot split');

-- Staff: edit or cancel one occurrence
select tests.authenticate_as('owner');
select throws_ok($$ insert into public.meetup_occurrences (meetup_id, occurrence, title)
  values ('f2000000-0000-4000-8000-000000000004', 9, 'x') $$, '23514', null, 'no edit of a missing occurrence');
select lives_ok($$ insert into public.meetup_occurrences (meetup_id, occurrence, title)
  values ('f2000000-0000-4000-8000-000000000004', 4, 'Last one') $$, 'edit one occurrence');
select lives_ok($$ insert into public.meetup_occurrences (meetup_id, occurrence, cancelled)
  values ('f2000000-0000-4000-8000-000000000004', 3, true) $$, 'cancel one occurrence');
select is_empty($$ select 1 from public.meetup_rsvps where meetup_id = 'f2000000-0000-4000-8000-000000000004'
  and occurrence = 3 $$, 'cancel drops its RSVPs');
select is(public.meetup_join_url('f2000000-0000-4000-8000-000000000004', 3), null, 'no join link for a cancelled occurrence');

-- Staff: "this and following" splits the series at occurrence 2
select lives_ok($$ select public.split_meetup('f2000000-0000-4000-8000-000000000004', 2) $$, 'split the series');
select results_eq($$ select starts_at, repeat_count from public.meetups
  where title = 'Daily' and id <> 'f2000000-0000-4000-8000-000000000004'
    and community_id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ select now() - interval '30 minutes', 3 $$, 'new series starts at the split occurrence with the rest of the count');
select results_eq($$ select repeat_count from public.meetups where id = 'f2000000-0000-4000-8000-000000000004' $$,
  $$ values (2) $$, 'old series ends before the split');
select results_eq($$ select r.occurrence, o.occurrence, o.cancelled from public.meetups m
  join public.meetup_rsvps r on r.meetup_id = m.id
  join public.meetup_occurrences o on o.meetup_id = m.id and o.cancelled
  where m.community_id = 'c0000000-0000-4000-8000-000000000001' and m.title = 'Daily'
    and m.id <> 'f2000000-0000-4000-8000-000000000004' $$,
  $$ values (0, 1, true) $$, 'RSVPs and edits move to the new series, renumbered');

-- Shortening a series drops RSVPs of occurrences that no longer exist
update public.meetups set repeat_count = 1 where id = 'f2000000-0000-4000-8000-000000000004';
select is_empty($$ select 1 from public.meetup_rsvps where meetup_id = 'f2000000-0000-4000-8000-000000000004' $$,
  'shorter series drops RSVPs past its end');

select * from finish(true);
rollback;
