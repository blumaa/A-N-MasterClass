-- Group 2 push: per-type push mutes. Own rows only, on own space, known types; gone with the profile.
begin;
select plan(9);

do $$
declare
  s uuid := '31031031-0310-4310-8310-310310310310';
  other uuid := '31031031-0310-4310-8310-31031031031f';
begin
  perform tests.create_supabase_user('mute-a');
  perform tests.create_supabase_user('mute-b');
  insert into public.spaces (id, slug, name, status) values
    (s, 'sqltest-mute', 'SQL test', 'live'), (other, 'sqltest-mute-other', 'SQL test', 'live');
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('mute-a'), 'A'), (s, tests.get_supabase_uid('mute-b'), 'B');
end $$;

create function pg_temp.mutes(who text) returns bigint language sql as $$
  select count(*) from public.push_mutes
  where space_id = '31031031-0310-4310-8310-310310310310' and profile_id = tests.get_supabase_uid(who);
$$;

select tests.authenticate_as('mute-a');
select lives_ok($$ insert into public.push_mutes (space_id, profile_id, type)
  values ('31031031-0310-4310-8310-310310310310', auth.uid(), 'reaction') $$, 'member mutes a type on own space');
select throws_ok($$ insert into public.push_mutes (space_id, profile_id, type)
  values ('31031031-0310-4310-8310-310310310310', auth.uid(), 'nope') $$, '23514', null, 'unknown type refused');
select throws_ok($$ insert into public.push_mutes (space_id, profile_id, type)
  values ('31031031-0310-4310-8310-31031031031f', auth.uid(), 'reaction') $$, '42501', null, 'no profile on that space');
select throws_ok($$ insert into public.push_mutes (space_id, profile_id, type)
  values ('31031031-0310-4310-8310-310310310310', tests.get_supabase_uid('mute-b'), 'reaction') $$,
  '42501', null, 'cannot mute for someone else');

select tests.authenticate_as('mute-b');
select is((select count(*) from public.push_mutes), 0::bigint, 'other member does not see the row');
delete from public.push_mutes;
reset role;
select is(pg_temp.mutes('mute-a'), 1::bigint, 'other member cannot delete it');

select tests.authenticate_as('mute-a');
delete from public.push_mutes where type = 'reaction';
reset role;
select is(pg_temp.mutes('mute-a'), 0::bigint, 'member unmutes own row');

select tests.authenticate_as('mute-a');
insert into public.push_mutes (space_id, profile_id, type) values ('31031031-0310-4310-8310-310310310310', auth.uid(), 'mention');
reset role;
delete from public.space_profiles
  where space_id = '31031031-0310-4310-8310-310310310310' and profile_id = tests.get_supabase_uid('mute-a');
select is(pg_temp.mutes('mute-a'), 0::bigint, 'rows go with the space profile');

select tests.clear_authentication();
select throws_ok($$ select * from public.push_mutes $$, '42501', null, 'visitors have no access');

select * from finish(true);
rollback;
