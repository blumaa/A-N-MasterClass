-- Every table exists and has RLS. Pairs existence (positive) with RLS (negative).
begin;
select plan(32);

select has_table('public', t, t || ' exists')
from unnest(array[
  'spaces', 'space_domains', 'profiles', 'space_profiles', 'space_members', 'role_capabilities',
  'products', 'programs', 'modules', 'steps', 'parts', 'grants', 'step_progress', 'video_position', 'space_branding'
]) as t;

select ok(c.relrowsecurity, c.relname || ' has RLS')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = any(array[
  'spaces', 'space_domains', 'profiles', 'space_profiles', 'space_members', 'role_capabilities',
  'products', 'programs', 'modules', 'steps', 'parts', 'grants', 'step_progress', 'video_position', 'space_branding'
]);

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'no public table without RLS');

select is((select count(*)::int from public.role_capabilities), 28, 'matrix has 28 rows');

select * from finish(true);
rollback;
