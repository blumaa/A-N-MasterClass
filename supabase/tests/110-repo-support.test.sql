-- Repo support: programs row trigger, move_row (swap, edges, scope, RLS).
begin;
select plan(9);

do $$
declare
  sp uuid := '11111111-1111-4111-8111-111111111111';
  prog uuid := 'a0000000-0000-4000-8000-000000000001';
  prog2 uuid := 'a0000000-0000-4000-8000-000000000002';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('outsider');
  insert into public.spaces (id, slug, name, status) values (sp, 'alexander', 'Alexander', 'live');
  insert into public.space_members values (sp, tests.get_supabase_uid('owner'), 'owner', now());
  insert into public.products (id, space_id, kind, slug, title) values
    (prog, sp, 'program', 'one', 'One'),
    (prog2, sp, 'program', 'two', 'Two');
  insert into public.modules (id, program_id, title, position) values
    ('b0000000-0000-4000-8000-000000000001', prog, 'A', 0),
    ('b0000000-0000-4000-8000-000000000002', prog, 'B', 1),
    ('b0000000-0000-4000-8000-000000000003', prog, 'C', 2),
    ('b0000000-0000-4000-8000-000000000004', prog2, 'Other', 0);
end $$;

select ok(exists (select 1 from public.programs where product_id = 'a0000000-0000-4000-8000-000000000001'),
  'program product gets its programs row');
select is_empty($$ select 1 from public.programs p join public.products x on x.id = p.product_id where x.kind <> 'program' $$,
  'only program products get a programs row');

select tests.authenticate_as('owner');
select public.move_row('modules', 'b0000000-0000-4000-8000-000000000003', 'up');
select results_eq($$ select title from public.modules where program_id = 'a0000000-0000-4000-8000-000000000001' order by position $$,
  $$ values ('A'::text), ('C'), ('B') $$, 'up swaps with the previous sibling');
select public.move_row('modules', 'b0000000-0000-4000-8000-000000000001', 'down');
select results_eq($$ select title from public.modules where program_id = 'a0000000-0000-4000-8000-000000000001' order by position $$,
  $$ values ('C'::text), ('A'), ('B') $$, 'down swaps with the next sibling');
select public.move_row('modules', 'b0000000-0000-4000-8000-000000000003', 'up');
select results_eq($$ select title from public.modules where program_id = 'a0000000-0000-4000-8000-000000000001' order by position $$,
  $$ values ('C'::text), ('A'), ('B') $$, 'first row up is a no-op');
select results_eq($$ select position from public.modules where id = 'b0000000-0000-4000-8000-000000000004' $$,
  $$ values (0) $$, 'other program untouched');
select throws_ok($$ select public.move_row('products', 'b0000000-0000-4000-8000-000000000001', 'up') $$,
  '22023', null, 'unknown table refused');

select tests.authenticate_as('outsider');
select public.move_row('modules', 'b0000000-0000-4000-8000-000000000002', 'up');
select tests.authenticate_as('owner');
select results_eq($$ select title from public.modules where program_id = 'a0000000-0000-4000-8000-000000000001' order by position $$,
  $$ values ('C'::text), ('A'), ('B') $$, 'outsider cannot reorder (RLS)');

select tests.clear_authentication();
select throws_ok($$ select public.move_row('modules', 'b0000000-0000-4000-8000-000000000002', 'up') $$,
  '42501', null, 'anon cannot call move_row');

select * from finish(true);
rollback;
