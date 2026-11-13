-- Certificate share links: member turns a random token on or off; anyone reads the minimum through shared_certificate.
begin;
select plan(16);

do $$
declare
  sp uuid := '32000000-0000-4000-8000-000000000001';
  other uuid := '32000000-0000-4000-8000-000000000002';
  prog uuid := '32a00000-0000-4000-8000-000000000001';
  m1 uuid := '32b00000-0000-4000-8000-000000000001';
begin
  perform tests.create_supabase_user('share_student');
  perform tests.create_supabase_user('share_nameless');
  perform tests.create_supabase_user('share_stranger');

  insert into public.spaces (id, slug, name, status) values
    (sp, 'share-space', 'Share space', 'live'),
    (other, 'share-other', 'Other space', 'live');
  insert into public.space_profiles (space_id, profile_id, display_name)
    values (sp, tests.get_supabase_uid('share_student'), 'Ada Student');
  insert into public.products (id, space_id, kind, slug, title, status, certificates)
    values (prog, sp, 'program', 'share-prog', 'Share program', 'published', true);
  insert into public.modules (id, program_id, title, status, position) values (m1, prog, 'One', 'published', 0);
  insert into public.steps (id, module_id, title, status)
    values ('32c00000-0000-4000-8000-000000000001', m1, 'A', 'published');
  insert into public.grants (product_id, profile_id, source) values
    (prog, tests.get_supabase_uid('share_student'), 'manual'),
    (prog, tests.get_supabase_uid('share_nameless'), 'manual');
  insert into public.step_progress (profile_id, step_id) values
    (tests.get_supabase_uid('share_student'), '32c00000-0000-4000-8000-000000000001'),
    (tests.get_supabase_uid('share_nameless'), '32c00000-0000-4000-8000-000000000001');
end $$;

create temp table share_seen (label text primary key, token text);
grant all on share_seen to anon, authenticated;

select tests.authenticate_as('share_student');
select throws_ok($$ select public.set_certificate_sharing('32a00000-0000-4000-8000-000000000001', true) $$,
  '42501', null, 'no certificate yet: nothing to share');
insert into share_seen select 'serial', (public.issue_certificate('32a00000-0000-4000-8000-000000000001')).id::text;
select is((select share_token from public.certificates where profile_id = auth.uid()), null, 'new certificates are private');
insert into share_seen
  select 'first', (public.set_certificate_sharing('32a00000-0000-4000-8000-000000000001', true)).share_token;
select matches((select token from share_seen where label = 'first'), '^[0-9a-f]{32}$', 'share token is 32 random hex chars');
select isnt((select token from share_seen where label = 'first'),
  (select replace(id::text, '-', '') from public.certificates where profile_id = auth.uid()), 'token is not the serial');
select is((public.set_certificate_sharing('32a00000-0000-4000-8000-000000000001', true)).share_token,
  (select token from share_seen where label = 'first'), 'sharing again keeps the link');
update public.certificates set share_token = 'ffffffffffffffffffffffffffffffff' where profile_id = auth.uid();
select is((select share_token from public.certificates where profile_id = auth.uid()),
  (select token from share_seen where label = 'first'), 'member cannot write the token directly');

select tests.clear_authentication();
select is_empty($$ select 1 from public.certificates $$, 'anon reads no certificate rows');
select results_eq($$ select member_name, program_title, serial
    from public.shared_certificate('32000000-0000-4000-8000-000000000001', (select token from share_seen where label = 'first')) $$,
  $$ select 'Ada Student'::text, 'Share program'::text, (select token::uuid from share_seen where label = 'serial') $$,
  'anon reads name, program, serial through the token');
select is_empty($$ select 1 from public.shared_certificate('32000000-0000-4000-8000-000000000002',
  (select token from share_seen where label = 'first')) $$, 'token does not work under another space');
select is_empty($$ select 1 from public.shared_certificate('32000000-0000-4000-8000-000000000001',
  '00000000000000000000000000000000') $$, 'unknown token reads nothing');

select tests.authenticate_as('share_stranger');
select throws_ok($$ select public.set_certificate_sharing('32a00000-0000-4000-8000-000000000001', true) $$,
  '42501', null, 'stranger has no certificate to share');

select tests.authenticate_as('share_student');
select is((public.set_certificate_sharing('32a00000-0000-4000-8000-000000000001', false)).share_token, null, 'stop sharing clears the token');
select tests.clear_authentication();
select is_empty($$ select 1 from public.shared_certificate('32000000-0000-4000-8000-000000000001',
  (select token from share_seen where label = 'first')) $$, 'revoked link reads nothing');

select tests.authenticate_as('share_student');
insert into share_seen
  select 'second', (public.set_certificate_sharing('32a00000-0000-4000-8000-000000000001', true)).share_token;
select isnt((select token from share_seen where label = 'second'),
  (select token from share_seen where label = 'first'), 'sharing again makes a new link');
reset role;
update public.products set certificates = false where id = '32a00000-0000-4000-8000-000000000001';
select tests.clear_authentication();
select is_empty($$ select 1 from public.shared_certificate('32000000-0000-4000-8000-000000000001',
  (select token from share_seen where label = 'second')) $$, 'certificates turned off: shared links read nothing');
reset role;
update public.products set certificates = true where id = '32a00000-0000-4000-8000-000000000001';

select tests.authenticate_as('share_nameless');
select public.issue_certificate('32a00000-0000-4000-8000-000000000001');
select throws_ok($$ select public.set_certificate_sharing('32a00000-0000-4000-8000-000000000001', true) $$,
  '23514', null, 'no space profile name: cannot share (no email on a public page)');

select * from finish(true);
rollback;
