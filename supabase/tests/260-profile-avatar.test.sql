-- Member avatar must be one object in the member's own avatar folder; bio and name lengths capped.
begin;
select plan(6);

insert into public.spaces (id, slug, name, status)
  values ('26000000-0000-4000-8000-000000000001', 'avatar-space', 'Avatar space', 'live');
select tests.create_supabase_user('avatar-member');
select tests.create_supabase_user('avatar-other');
insert into public.space_profiles (space_id, profile_id, display_name)
  values ('26000000-0000-4000-8000-000000000001', tests.get_supabase_uid('avatar-member'), 'Member');

create temp table t as select
  '26000000-0000-4000-8000-000000000001/avatars/' || tests.get_supabase_uid('avatar-member')::text as own,
  '26000000-0000-4000-8000-000000000001/avatars/' || tests.get_supabase_uid('avatar-other')::text as other,
  tests.get_supabase_uid('avatar-member') as uid;

select lives_ok(format($$ update public.space_profiles set avatar_path = %L where profile_id = %L $$,
  (select own from t) || '/a-me.png', (select uid from t)), 'avatar in own folder accepted');
select throws_ok(format($$ update public.space_profiles set avatar_path = %L where profile_id = %L $$,
  (select other from t) || '/a-me.png', (select uid from t)), '23514', null, 'avatar in another member folder refused');
select throws_ok(format($$ update public.space_profiles set avatar_path = %L where profile_id = %L $$,
  (select own from t) || '/x/a.png', (select uid from t)), '23514', null, 'avatar in a subfolder refused');
select throws_ok(format($$ update public.space_profiles set avatar_path = %L where profile_id = %L $$,
  '26000000-0000-4000-8000-000000000001/site/a.png', (select uid from t)), '23514', null, 'site image as avatar refused');
select throws_ok(format($$ update public.space_profiles set bio = repeat('x', 1001) where profile_id = %L $$,
  (select uid from t)), '23514', null, 'bio over 1000 chars refused');
select throws_ok(format($$ update public.space_profiles set display_name = repeat('x', 81) where profile_id = %L $$,
  (select uid from t)), '23514', null, 'name over 80 chars refused');

select * from finish(true);
rollback;
