-- Launch 6 item 11 (G26): completion certificates. Studio turns them on per program
-- (products.certificates). A member with access who finished every published step of every
-- published module gets one certificate row; the PDF is drawn from it on the server.

alter table public.products add column certificates boolean not null default false
  constraint products_certificates_program check (not certificates or kind = 'program');

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.products (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  issued_at timestamptz not null default now(),
  constraint certificates_once unique (program_id, profile_id)
);
create index certificates_member on public.certificates (profile_id);

alter table public.certificates enable row level security;

-- Own certificates, plus staff who manage customers. Written only by issue_certificate.
create policy certificates_read on public.certificates for select
  using (profile_id = auth.uid()
         or public.has_capability((select p.space_id from public.products p where p.id = program_id), 'customers.manage'));

-- Issue (or return) the caller's certificate. Same rule as the program outline: every published
-- step in a published module is done, and there is at least one.
create function public.issue_certificate(target_program uuid) returns public.certificates
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prog public.products;
  total integer;
  done integer;
  result public.certificates;
begin
  select * into prog from public.products where id = target_program;
  if uid is null or prog.id is null or prog.kind <> 'program' or prog.status <> 'published'
     or public.active_grant_at(target_program) is null then
    raise exception 'program not open' using errcode = '42501';
  end if;
  if not prog.certificates then
    raise exception 'new row for relation "certificates" violates constraint "certificates_off"' using errcode = '23514';
  end if;
  select * into result from public.certificates where program_id = target_program and profile_id = uid;
  if found then
    return result;
  end if;
  select count(*), count(sp.step_id) into total, done
  from public.steps st
  join public.modules m on m.id = st.module_id
  left join public.step_progress sp on sp.step_id = st.id and sp.profile_id = uid
  where m.program_id = target_program and m.status = 'published' and st.status = 'published';
  if total = 0 or done < total then
    raise exception 'new row for relation "certificates" violates constraint "certificate_not_earned"'
      using errcode = '23514';
  end if;
  insert into public.certificates (program_id, profile_id) values (target_program, uid)
  on conflict (program_id, profile_id) do nothing;
  select * into result from public.certificates where program_id = target_program and profile_id = uid;
  return result;
end;
$$;

revoke execute on function public.issue_certificate(uuid) from public, anon;
grant execute on function public.issue_certificate(uuid) to authenticated, service_role;
