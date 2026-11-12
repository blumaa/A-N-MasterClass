-- Certificates (Launch 6 item 11): per-program toggle, issued at 100% of published steps.
begin;
select plan(12);

do $$
declare
  sp uuid := '20000000-0000-4000-8000-000000000001';
  prog uuid := '20a00000-0000-4000-8000-000000000001';
  m1 uuid := '20b00000-0000-4000-8000-000000000001';
  m2 uuid := '20b00000-0000-4000-8000-000000000002';
begin
  perform tests.create_supabase_user('cert_student');
  perform tests.create_supabase_user('cert_stranger');
  perform tests.create_supabase_user('cert_support');
  perform tests.create_supabase_user('cert_editor');

  insert into public.spaces (id, slug, name, status) values (sp, 'cert-space', 'Cert space', 'live');
  insert into public.space_members values
    (sp, tests.get_supabase_uid('cert_support'), 'support', now()),
    (sp, tests.get_supabase_uid('cert_editor'), 'assistant', now());
  insert into public.products (id, space_id, kind, slug, title, status)
    values (prog, sp, 'program', 'cert-prog', 'Cert program', 'published');
  insert into public.modules (id, program_id, title, status, position) values
    (m1, prog, 'One', 'published', 0),
    (m2, prog, 'Draft', 'draft', 1);
  insert into public.steps (id, module_id, title, status) values
    ('20c00000-0000-4000-8000-000000000001', m1, 'A', 'published'),
    ('20c00000-0000-4000-8000-000000000002', m1, 'B', 'published'),
    ('20c00000-0000-4000-8000-000000000003', m1, 'Draft step', 'draft'),
    ('20c00000-0000-4000-8000-000000000004', m2, 'In draft module', 'published');
  insert into public.grants (product_id, profile_id, source)
    values (prog, tests.get_supabase_uid('cert_student'), 'manual');
  insert into public.step_progress (profile_id, step_id)
    values (tests.get_supabase_uid('cert_student'), '20c00000-0000-4000-8000-000000000001');
end $$;

select throws_ok($$ insert into public.products (space_id, kind, slug, title, certificates)
  values ('20000000-0000-4000-8000-000000000001', 'community', 'cert-comm', 'C', true) $$,
  '23514', null, 'only programs take certificates');

select tests.authenticate_as('cert_student');
select throws_ok($$ select public.issue_certificate('20a00000-0000-4000-8000-000000000001') $$,
  '23514', null, 'toggle off: no certificate');
reset role;
update public.products set certificates = true where id = '20a00000-0000-4000-8000-000000000001';

select tests.authenticate_as('cert_student');
select throws_ok($$ select public.issue_certificate('20a00000-0000-4000-8000-000000000001') $$,
  '23514', null, 'unfinished program: no certificate');
select throws_ok($$ insert into public.certificates (program_id, profile_id)
  values ('20a00000-0000-4000-8000-000000000001', auth.uid()) $$, '42501', null, 'no direct insert');
insert into public.step_progress (profile_id, step_id) values (auth.uid(), '20c00000-0000-4000-8000-000000000002');
select isnt((public.issue_certificate('20a00000-0000-4000-8000-000000000001')).id, null,
  'every published step done: issued (draft steps and modules do not count)');
select results_eq($$ select (public.issue_certificate('20a00000-0000-4000-8000-000000000001')).id $$,
  $$ select id from public.certificates where program_id = '20a00000-0000-4000-8000-000000000001' $$,
  'issuing again returns the same certificate');
select results_eq($$ select count(*)::int from public.certificates where program_id = '20a00000-0000-4000-8000-000000000001' $$,
  $$ values (1) $$, 'member reads own certificate');

select tests.authenticate_as('cert_stranger');
select throws_ok($$ select public.issue_certificate('20a00000-0000-4000-8000-000000000001') $$,
  '42501', null, 'no grant, no certificate');
select is_empty($$ select 1 from public.certificates where program_id = '20a00000-0000-4000-8000-000000000001' $$,
  'other members certificates hidden');

select tests.authenticate_as('cert_support');
select results_eq($$ select count(*)::int from public.certificates where program_id = '20a00000-0000-4000-8000-000000000001' $$,
  $$ values (1) $$, 'staff with customers.manage read certificates');

select tests.authenticate_as('cert_editor');
select throws_ok($$ select public.issue_certificate('20a00000-0000-4000-8000-000000000001') $$,
  '42501', null, 'editor without a grant gets no certificate');

select tests.clear_authentication();
select throws_ok($$ select public.issue_certificate('20a00000-0000-4000-8000-000000000001') $$,
  '42501', null, 'anon cannot issue');

select * from finish(true);
rollback;
