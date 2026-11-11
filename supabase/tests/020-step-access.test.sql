-- can_read_step: grant, publish state, module lock (G7), drip (G8), staff preview.
begin;
select plan(13);

do $$
declare
  sp uuid := '11111111-1111-4111-8111-111111111111';
  prog uuid := 'a0000000-0000-4000-8000-000000000001';
  m_open uuid := 'b0000000-0000-4000-8000-000000000001';
  m_locked uuid := 'b0000000-0000-4000-8000-000000000002';
  m_drip_due uuid := 'b0000000-0000-4000-8000-000000000003';
  m_drip_later uuid := 'b0000000-0000-4000-8000-000000000004';
  m_dated uuid := 'b0000000-0000-4000-8000-000000000005';
begin
  perform tests.create_supabase_user('student');
  perform tests.create_supabase_user('stranger');
  perform tests.create_supabase_user('assistant');

  insert into public.spaces (id, slug, name, status) values (sp, 'alexander', 'Alexander', 'live');
  insert into public.space_members values (sp, tests.get_supabase_uid('assistant'), 'assistant', now());
  insert into public.products (id, space_id, kind, slug, title, status)
    values (prog, sp, 'program', 'rope-1', 'Rope 1', 'published');

  insert into public.modules (id, program_id, title, status, position) values
    (m_open, prog, 'Open', 'published', 0),
    (m_locked, prog, 'Locked', 'published', 1),
    (m_drip_due, prog, 'Drip due', 'published', 2),
    (m_drip_later, prog, 'Drip later', 'published', 3),
    (m_dated, prog, 'Dated', 'published', 4);

  insert into public.steps (id, module_id, title, status) values
    ('c0000000-0000-4000-8000-000000000001', m_open, 'Intro', 'published'),
    ('c0000000-0000-4000-8000-000000000002', m_open, 'Draft', 'draft'),
    ('c0000000-0000-4000-8000-000000000003', m_locked, 'After intro', 'published'),
    ('c0000000-0000-4000-8000-000000000004', m_drip_due, 'Week 1', 'published'),
    ('c0000000-0000-4000-8000-000000000005', m_drip_later, 'Week 4', 'published'),
    ('c0000000-0000-4000-8000-000000000006', m_dated, 'Future', 'published');

  update public.modules set unlock_after_step_id = 'c0000000-0000-4000-8000-000000000001' where id = m_locked;
  update public.modules set release_after_days = 5 where id = m_drip_due;
  update public.modules set release_after_days = 30 where id = m_drip_later;
  update public.modules set release_at = now() + interval '1 day' where id = m_dated;

  insert into public.parts (step_id, kind, body) values
    ('c0000000-0000-4000-8000-000000000001', 'text', '{"doc": "intro"}');

  insert into public.grants (product_id, profile_id, source, granted_at)
    values (prog, tests.get_supabase_uid('student'), 'manual', now() - interval '10 days');
end $$;

select tests.authenticate_as('student');
select ok(public.can_read_step('c0000000-0000-4000-8000-000000000001'), 'granted student reads open step');
select ok(not public.can_read_step('c0000000-0000-4000-8000-000000000002'), 'draft step hidden');
select ok(not public.can_read_step('c0000000-0000-4000-8000-000000000003'), 'locked module closed before unlock step');
select ok(public.can_read_step('c0000000-0000-4000-8000-000000000004'), 'drip day 5 open at day 10');
select ok(not public.can_read_step('c0000000-0000-4000-8000-000000000005'), 'drip day 30 closed at day 10');
select ok(not public.can_read_step('c0000000-0000-4000-8000-000000000006'), 'future release_at closed');
select isnt_empty($$ select 1 from public.parts $$, 'student reads parts of open step');

select lives_ok($$ insert into public.step_progress (profile_id, step_id)
  values (auth.uid(), 'c0000000-0000-4000-8000-000000000001') $$, 'complete open step');
select ok(public.can_read_step('c0000000-0000-4000-8000-000000000003'), 'locked module opens after unlock step');
select results_eq($$ select completed, total from public.program_progress('a0000000-0000-4000-8000-000000000001') $$,
  $$ values (1, 5) $$, 'progress counts published steps only');
select throws_ok($$ insert into public.step_progress (profile_id, step_id)
  values (auth.uid(), 'c0000000-0000-4000-8000-000000000005') $$, '42501', null, 'cannot complete undripped step');

select tests.authenticate_as('stranger');
select is_empty($$ select 1 from public.parts $$, 'no grant, no parts');

select tests.authenticate_as('assistant');
select ok(public.can_read_step('c0000000-0000-4000-8000-000000000002'), 'staff previews draft step');

select * from finish(true);
rollback;
