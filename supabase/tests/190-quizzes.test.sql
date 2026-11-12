-- Quizzes (Launch 6 item 11): answer keys hidden from members, server grading, quiz_passed unlock.
begin;
select plan(26);

do $$
declare
  sp uuid := '19000000-0000-4000-8000-000000000001';
  prog uuid := '19a00000-0000-4000-8000-000000000001';
  m1 uuid := '19b00000-0000-4000-8000-000000000001';
  m2 uuid := '19b00000-0000-4000-8000-000000000002';
  s1 uuid := '19c00000-0000-4000-8000-000000000001';
  s2 uuid := '19c00000-0000-4000-8000-000000000002';
begin
  perform tests.create_supabase_user('quiz_student');
  perform tests.create_supabase_user('quiz_stranger');
  perform tests.create_supabase_user('quiz_editor');

  insert into public.spaces (id, slug, name, status) values (sp, 'quiz-space', 'Quiz space', 'live');
  insert into public.space_members values (sp, tests.get_supabase_uid('quiz_editor'), 'assistant', now());
  insert into public.products (id, space_id, kind, slug, title, status)
    values (prog, sp, 'program', 'quiz-prog', 'Quiz program', 'published');
  insert into public.modules (id, program_id, title, status, position) values
    (m1, prog, 'One', 'published', 0),
    (m2, prog, 'Two', 'published', 1);
  insert into public.steps (id, module_id, title, status) values
    (s1, m1, 'Lesson', 'published'),
    (s2, m2, 'After quiz', 'published');

  insert into public.parts (id, step_id, kind, pass_percent) values
    ('19d00000-0000-4000-8000-000000000001', s1, 'quiz', 60),
    ('19d00000-0000-4000-8000-000000000002', s1, 'quiz', null),
    ('19d00000-0000-4000-8000-000000000003', s1, 'text', null);

  insert into public.quiz_questions (id, part_id, prompt, position, multiple) values
    ('19e00000-0000-4000-8000-000000000001', '19d00000-0000-4000-8000-000000000001', 'Single', 0, false),
    ('19e00000-0000-4000-8000-000000000002', '19d00000-0000-4000-8000-000000000001', 'Many', 1, true);
  insert into public.quiz_options (id, question_id, label, position) values
    ('19f00000-0000-4000-8000-00000000000a', '19e00000-0000-4000-8000-000000000001', 'A', 0),
    ('19f00000-0000-4000-8000-00000000000b', '19e00000-0000-4000-8000-000000000001', 'B', 1),
    ('19f00000-0000-4000-8000-00000000000c', '19e00000-0000-4000-8000-000000000002', 'C', 0),
    ('19f00000-0000-4000-8000-00000000000d', '19e00000-0000-4000-8000-000000000002', 'D', 1),
    ('19f00000-0000-4000-8000-00000000000e', '19e00000-0000-4000-8000-000000000002', 'E', 2);
  insert into public.quiz_keys (option_id) values
    ('19f00000-0000-4000-8000-00000000000a'),
    ('19f00000-0000-4000-8000-00000000000c'),
    ('19f00000-0000-4000-8000-00000000000d');

  update public.modules set unlock_quiz_part_id = '19d00000-0000-4000-8000-000000000001' where id = m2;
  insert into public.grants (product_id, profile_id, source)
    values (prog, tests.get_supabase_uid('quiz_student'), 'manual');
end $$;

select tests.authenticate_as('quiz_student');
select results_eq($$ select count(*)::int from public.quiz_options o join public.quiz_questions q on q.id = o.question_id
  where q.part_id = '19d00000-0000-4000-8000-000000000001' $$, $$ values (5) $$, 'member reads questions and options');
select is_empty($$ select 1 from public.quiz_keys where option_id::text like '19f00000-%' $$, 'member never reads the answer key');
select ok(not public.can_read_step('19c00000-0000-4000-8000-000000000002'), 'quiz-locked module closed before a pass');
select throws_ok($$ insert into public.quiz_attempts (part_id, profile_id, score, passed)
  values ('19d00000-0000-4000-8000-000000000001', auth.uid(), 100, true) $$, '42501', null, 'no direct attempt insert');
select results_eq($$ select score, passed, correct_question_ids from public.submit_quiz('19d00000-0000-4000-8000-000000000001',
  array['19f00000-0000-4000-8000-00000000000b', '19f00000-0000-4000-8000-00000000000c']::uuid[]) $$,
  $$ values (0, false, '{}'::uuid[]) $$, 'wrong answers score 0');
select results_eq($$ select score, passed from public.submit_quiz('19d00000-0000-4000-8000-000000000001',
  array['19f00000-0000-4000-8000-00000000000a', '19f00000-0000-4000-8000-00000000000c']::uuid[]) $$,
  $$ values (50, false) $$, 'checkbox question needs every correct option');
select results_eq($$ select score, passed from public.submit_quiz('19d00000-0000-4000-8000-000000000001',
  array['19f00000-0000-4000-8000-00000000000a', '19f00000-0000-4000-8000-00000000000c', '19f00000-0000-4000-8000-00000000000d',
        '19f00000-0000-4000-8000-00000000000e']::uuid[]) $$,
  $$ values (50, false) $$, 'an extra wrong option fails the question');
select ok(not public.can_read_step('19c00000-0000-4000-8000-000000000002'), 'failed attempts keep the module locked');
select results_eq($$ select score, passed, correct_question_ids from public.submit_quiz('19d00000-0000-4000-8000-000000000001',
  array['19f00000-0000-4000-8000-00000000000a', '19f00000-0000-4000-8000-00000000000c', '19f00000-0000-4000-8000-00000000000d']::uuid[]) $$,
  $$ values (100, true, array['19e00000-0000-4000-8000-000000000001', '19e00000-0000-4000-8000-000000000002']::uuid[]) $$,
  'all right passes');
select ok(public.can_read_step('19c00000-0000-4000-8000-000000000002'), 'a pass opens the quiz-locked module');
select results_eq($$ select count(*)::int from public.quiz_attempts where part_id = '19d00000-0000-4000-8000-000000000001' $$,
  $$ values (4) $$, 'member reads own attempts');
select throws_ok($$ select public.submit_quiz('19d00000-0000-4000-8000-000000000002', '{}') $$,
  '23514', null, 'a quiz with no questions cannot be submitted');
select throws_ok($$ select public.submit_quiz('19d00000-0000-4000-8000-000000000003', '{}') $$,
  '42501', null, 'only quiz parts are submitted');
select throws_ok($$ select public.save_quiz_question('19d00000-0000-4000-8000-000000000001', null, 'Hack',
  array['x', 'y'], array[true, false]) $$, '42501', null, 'member cannot write questions');

select tests.authenticate_as('quiz_stranger');
select throws_ok($$ select public.submit_quiz('19d00000-0000-4000-8000-000000000001', '{}') $$,
  '42501', null, 'no grant, no submit');
select is_empty($$ select 1 from public.quiz_questions where part_id = '19d00000-0000-4000-8000-000000000001' $$,
  'no grant, no questions');
select is_empty($$ select 1 from public.quiz_attempts where part_id = '19d00000-0000-4000-8000-000000000001' $$,
  'other members attempts hidden');

select tests.authenticate_as('quiz_editor');
select isnt_empty($$ select 1 from public.quiz_keys where option_id = '19f00000-0000-4000-8000-00000000000a' $$,
  'editor reads the answer key');
select isnt(public.save_quiz_question('19d00000-0000-4000-8000-000000000002', null, 'New',
  array['x', 'y', 'z'], array[true, false, true]), null, 'editor adds a question');
select results_eq($$ select multiple from public.quiz_questions where part_id = '19d00000-0000-4000-8000-000000000002' $$,
  $$ values (true) $$, 'two correct options make a checkbox question');
select isnt(public.save_quiz_question('19d00000-0000-4000-8000-000000000001', '19e00000-0000-4000-8000-000000000001',
  'Single', array['p', 'q', 'r'], array[false, false, true]), null, 'editor edits a question');
select results_eq($$ select count(*)::int from public.quiz_options where question_id = '19e00000-0000-4000-8000-000000000001' $$,
  $$ values (3) $$, 'saving a question replaces its options');
select throws_ok($$ select public.save_quiz_question('19d00000-0000-4000-8000-000000000001', null, 'One option',
  array['x'], array[true]) $$, '23514', null, 'a question needs two options');
select throws_ok($$ select public.save_quiz_question('19d00000-0000-4000-8000-000000000001', null, 'No answer',
  array['x', 'y'], array[false, false]) $$, '23514', null, 'a question needs a correct option');
select throws_ok($$ update public.parts set pass_percent = 0 where id = '19d00000-0000-4000-8000-000000000001' $$,
  '23514', null, 'pass mark is 1 to 100');
delete from public.parts where id = '19d00000-0000-4000-8000-000000000001';
select results_eq($$ select unlock_quiz_part_id from public.modules where id = '19b00000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid) $$, 'deleting the quiz clears the module lock');

select * from finish(true);
rollback;
