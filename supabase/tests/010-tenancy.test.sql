-- Staff roles, capability matrix, cross-space isolation (G2, G15).
begin;
select plan(14);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := '22222222-2222-4222-8222-222222222222';
begin
  perform tests.create_supabase_user('owner_a');
  perform tests.create_supabase_user('assistant_a');
  perform tests.create_supabase_user('owner_b');
  perform tests.create_supabase_user('root');
  update public.profiles set is_platform_admin = true where id = tests.get_supabase_uid('root');

  insert into public.spaces (id, slug, name, status) values
    (a, 'alexander', 'Alexander', 'live'), (b, 'natasha', 'Natasha', 'draft');
  insert into public.space_members (space_id, profile_id, role) values
    (a, tests.get_supabase_uid('owner_a'), 'owner'),
    (a, tests.get_supabase_uid('assistant_a'), 'assistant'),
    (b, tests.get_supabase_uid('owner_b'), 'owner');
end $$;

-- Slug constraint mirrors src/lib/tenancy/slug.ts.
select throws_ok($$ insert into public.spaces (slug, name) values ('www', 'x') $$, '23514', null, 'reserved slug refused');
select throws_ok($$ insert into public.spaces (slug, name) values ('Bad_Slug', 'x') $$, '23514', null, 'malformed slug refused');

select tests.authenticate_as('owner_a');
select ok(public.has_capability('11111111-1111-4111-8111-111111111111', 'payments.manage'), 'owner has payments');
select ok(not public.has_capability('22222222-2222-4222-8222-222222222222', 'products.edit'), 'owner of A has nothing in B');
select set_eq($$ select slug from public.spaces where slug in ('alexander', 'natasha') $$,
  array['alexander'], 'owner A sees live A, not draft B');
select set_eq($$ select role from public.space_members $$,
  array['owner', 'assistant'], 'owner A sees only A staff');

select tests.authenticate_as('assistant_a');
select ok(public.has_capability('11111111-1111-4111-8111-111111111111', 'products.edit'), 'assistant edits products');
select ok(not public.has_capability('11111111-1111-4111-8111-111111111111', 'staff.manage'), 'assistant cannot manage staff');
select throws_ok(
  $$ insert into public.space_members (space_id, profile_id, role)
     values ('11111111-1111-4111-8111-111111111111', tests.get_supabase_uid('owner_b'), 'admin') $$,
  '42501', null, 'assistant cannot add staff');

select tests.authenticate_as('owner_b');
select set_eq($$ select slug from public.spaces where slug in ('alexander', 'natasha') $$,
  array['alexander', 'natasha'], 'owner B sees own draft space plus live A');
select throws_ok(
  $$ update public.profiles set is_platform_admin = true where id = auth.uid() $$,
  '42501', null, 'cannot self-grant platform admin');

select tests.clear_authentication();
set local role anon;
select set_eq($$ select slug from public.spaces where slug in ('alexander', 'natasha') $$,
  array['alexander'], 'anon sees live spaces only');
select is_empty($$ select 1 from public.profiles $$, 'anon reads no profiles');

reset role;
select tests.authenticate_as('root');
select lives_ok($$ insert into public.spaces (slug, name) values ('third', 'Third') $$, 'platform admin creates spaces');

select * from finish(true);
rollback;
