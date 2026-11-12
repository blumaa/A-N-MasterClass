-- Launch 6 item 11 (G26): quizzes. A quiz is a part (kind 'quiz') with questions and options.
-- Members read questions and options with the step; the answer key (quiz_keys) is editor-only.
-- submit_quiz grades on the server and stores the attempt. A module can stay locked until a
-- quiz is passed (modules.unlock_quiz_part_id), enforced in can_read_step next to the G7 step lock.

alter table public.parts drop constraint parts_kind_check;
alter table public.parts add constraint parts_kind_check
  check (kind in ('video', 'text', 'download', 'image', 'embed', 'quiz'));
-- Pass mark in percent. Null: any attempt passes (completion only).
alter table public.parts add column pass_percent integer
  constraint parts_pass_percent check (pass_percent between 1 and 100);

alter table public.modules add column unlock_quiz_part_id uuid
  constraint modules_unlock_quiz_fk references public.parts (id) on delete set null;

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts (id) on delete cascade,
  prompt text not null constraint quiz_questions_prompt check (btrim(prompt) <> '' and length(prompt) <= 1000),
  position integer not null default 0,
  -- More than one correct option: checkboxes, else radio buttons. Set by save_quiz_question.
  multiple boolean not null default false
);
create index quiz_questions_part on public.quiz_questions (part_id, position);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  label text not null constraint quiz_options_label check (btrim(label) <> '' and length(label) <= 500),
  position integer not null default 0
);
create index quiz_options_question on public.quiz_options (question_id, position);

-- Correct options. Separate table so RLS can hide it from members.
create table public.quiz_keys (
  option_id uuid primary key references public.quiz_options (id) on delete cascade
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  correct_question_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index quiz_attempts_member on public.quiz_attempts (profile_id, part_id, created_at desc);

create function public.part_space(target_part uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select public.step_space((select pt.step_id from public.parts pt where pt.id = target_part));
$$;

alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_keys enable row level security;
alter table public.quiz_attempts enable row level security;

-- Questions and options follow the step: whoever reads the parts reads them.
create policy quiz_questions_read on public.quiz_questions for select
  using (public.can_read_step((select pt.step_id from public.parts pt where pt.id = part_id)));
create policy quiz_questions_write on public.quiz_questions for all
  using (public.has_capability(public.part_space(part_id), 'products.edit'))
  with check (public.has_capability(public.part_space(part_id), 'products.edit'));

create policy quiz_options_read on public.quiz_options for select
  using (exists (select 1 from public.quiz_questions q where q.id = question_id));
create policy quiz_options_write on public.quiz_options for all
  using (public.has_capability(
    public.part_space((select q.part_id from public.quiz_questions q where q.id = question_id)), 'products.edit'))
  with check (public.has_capability(
    public.part_space((select q.part_id from public.quiz_questions q where q.id = question_id)), 'products.edit'));

create policy quiz_keys_editor on public.quiz_keys for all
  using (public.has_capability(public.part_space((select q.part_id from public.quiz_options o
    join public.quiz_questions q on q.id = o.question_id where o.id = option_id)), 'products.edit'))
  with check (public.has_capability(public.part_space((select q.part_id from public.quiz_options o
    join public.quiz_questions q on q.id = o.question_id where o.id = option_id)), 'products.edit'));

-- Attempts: own, plus staff who see progress. Written only by submit_quiz.
create policy quiz_attempts_read on public.quiz_attempts for select
  using (profile_id = auth.uid()
         or public.has_capability(public.part_space(part_id), 'customers.manage')
         or public.has_capability(public.part_space(part_id), 'analytics.view'));

-- Create or replace a question with its options in one go (security invoker: RLS decides who may).
create function public.save_quiz_question(
  target_part uuid, target_question uuid, question_prompt text, option_labels text[], option_correct boolean[]
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  q uuid := target_question;
  n integer := coalesce(cardinality(option_labels), 0);
  o uuid;
  i integer;
begin
  if n < 2 or n <> coalesce(cardinality(option_correct), 0) or not (true = any (option_correct)) then
    raise exception 'new row for relation "quiz_questions" violates constraint "quiz_question_options"'
      using errcode = '23514';
  end if;
  if (select pt.kind from public.parts pt where pt.id = target_part) is distinct from 'quiz' then
    raise exception 'quiz not found' using errcode = '42501';
  end if;
  if q is null then
    insert into public.quiz_questions (part_id, prompt, position, multiple)
    values (target_part, question_prompt,
            coalesce((select max(qq.position) + 1 from public.quiz_questions qq where qq.part_id = target_part), 0),
            (select count(*) from unnest(option_correct) c where c) > 1)
    returning id into q;
  else
    update public.quiz_questions
      set prompt = question_prompt, multiple = (select count(*) from unnest(option_correct) c where c) > 1
      where id = q and part_id = target_part;
    if not found then
      raise exception 'question not found' using errcode = '42501';
    end if;
    delete from public.quiz_options where question_id = q;
  end if;
  for i in 1 .. n loop
    insert into public.quiz_options (question_id, label, position) values (q, option_labels[i], i - 1)
    returning id into o;
    if option_correct[i] then
      insert into public.quiz_keys (option_id) values (o);
    end if;
  end loop;
  return q;
end;
$$;

-- Grade picked options against the key and store the attempt. A question is right when the picked
-- options are exactly its correct ones. Score: percent of questions right, rounded.
-- Same rules as gradeQuiz in src/lib/programs/quiz.ts.
create function public.submit_quiz(target_part uuid, picked uuid[]) returns public.quiz_attempts
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  p public.parts;
  total integer;
  right_ids uuid[];
  pct integer;
  result public.quiz_attempts;
begin
  select * into p from public.parts where id = target_part;
  if uid is null or p.id is null or p.kind <> 'quiz' or not public.can_read_step(p.step_id) then
    raise exception 'quiz not open' using errcode = '42501';
  end if;
  select count(*) into total from public.quiz_questions where part_id = target_part;
  if total = 0 then
    raise exception 'new row for relation "quiz_attempts" violates constraint "quiz_empty"' using errcode = '23514';
  end if;
  select coalesce(array_agg(q.id order by q.position, q.id), '{}') into right_ids
  from public.quiz_questions q
  where q.part_id = target_part
    and not exists (
      select 1 from public.quiz_options o
      where o.question_id = q.id
        and (o.id = any (coalesce(picked, '{}'))) <> exists (select 1 from public.quiz_keys k where k.option_id = o.id));
  pct := round(100.0 * cardinality(right_ids) / total);
  insert into public.quiz_attempts (part_id, profile_id, score, passed, correct_question_ids)
  values (target_part, uid, pct, p.pass_percent is null or pct >= p.pass_percent, right_ids)
  returning * into result;
  return result;
end;
$$;

revoke execute on function public.save_quiz_question(uuid, uuid, text, text[], boolean[]) from public, anon;
grant execute on function public.save_quiz_question(uuid, uuid, text, text[], boolean[]) to authenticated, service_role;
revoke execute on function public.submit_quiz(uuid, uuid[]) from public, anon;
grant execute on function public.submit_quiz(uuid, uuid[]) to authenticated, service_role;

-- can_read_step: adds the quiz lock. Any passed attempt counts, so the module never locks again.
create or replace function public.can_read_step(target_step uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with s as (
    select st.status as step_status, m.status as module_status, pr.status as product_status,
           pr.id as product_id, pr.space_id, m.unlock_after_step_id, m.unlock_quiz_part_id,
           m.release_after_days, m.release_at
    from public.steps st
    join public.modules m on m.id = st.module_id
    join public.products pr on pr.id = m.program_id
    where st.id = target_step
  )
  select coalesce((
    select public.has_capability(s.space_id, 'products.edit') or (
      s.step_status = 'published' and s.module_status = 'published' and s.product_status = 'published'
      and public.active_grant_at(s.product_id) is not null
      and (s.unlock_after_step_id is null or exists (
        select 1 from public.step_progress sp
        where sp.profile_id = auth.uid() and sp.step_id = s.unlock_after_step_id))
      and (s.unlock_quiz_part_id is null or exists (
        select 1 from public.quiz_attempts qa
        where qa.profile_id = auth.uid() and qa.part_id = s.unlock_quiz_part_id and qa.passed))
      and (s.release_after_days is null
           or public.active_grant_at(s.product_id) + make_interval(days => s.release_after_days) <= now())
      and (s.release_at is null or s.release_at <= now())
    ) from s
  ), false);
$$;
