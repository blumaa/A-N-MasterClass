-- Platform admin sets up a space for an owner (G1): space, staff row, owner's space profile.
begin;
select plan(4);

do $$
begin
  perform tests.create_supabase_user('root');
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('stranger');
  update public.profiles set is_platform_admin = true where id = tests.get_supabase_uid('root');
  insert into public.spaces (id, slug, name) values ('11111111-1111-4111-8111-111111111111', 'sqltest-platform', 'SQL test');
end $$;

select tests.authenticate_as('root');
select lives_ok(
  $$ insert into public.space_members values ('11111111-1111-4111-8111-111111111111', tests.get_supabase_uid('owner'), 'owner', now()) $$,
  'platform admin adds the owner');
select lives_ok(
  $$ insert into public.space_profiles (space_id, profile_id, display_name)
     values ('11111111-1111-4111-8111-111111111111', tests.get_supabase_uid('owner'), 'Teacher') $$,
  'platform admin creates the owner''s space profile');

select tests.authenticate_as('stranger');
select throws_ok(
  $$ insert into public.space_profiles (space_id, profile_id, display_name)
     values ('11111111-1111-4111-8111-111111111111', tests.get_supabase_uid('root'), 'Fake') $$,
  '42501', null, 'others cannot create a space profile for someone else');

select tests.authenticate_as('owner');
select results_eq(
  $$ select display_name from public.space_profiles where profile_id = auth.uid() $$,
  $$ values ('Teacher'::text) $$, 'owner sees the profile');

select * from finish(true);
rollback;
