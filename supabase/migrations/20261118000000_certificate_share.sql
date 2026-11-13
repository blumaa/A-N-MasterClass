-- Group 2 certificates: public share link. Off by default. The member turns it on
-- (random 32-hex token) or off (token cleared, old link dead). Anyone reads only
-- name, program, date and serial through shared_certificate; certificates rows stay private.

alter table public.certificates add column share_token text unique
  constraint certificates_share_token_format check (share_token ~ '^[0-9a-f]{32}$');

-- Turn the caller's share link on or off. Needs an issued certificate, certificates still on
-- for the program, and a space display name (the public page never shows an email).
create function public.set_certificate_sharing(target_program uuid, shared boolean) returns public.certificates
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prog public.products;
  result public.certificates;
begin
  select * into result from public.certificates where program_id = target_program and profile_id = uid;
  if uid is null or result.id is null then
    raise exception 'certificate not found' using errcode = '42501';
  end if;
  select * into prog from public.products where id = target_program;
  if not prog.certificates then
    raise exception 'new row for relation "certificates" violates constraint "certificates_off"' using errcode = '23514';
  end if;
  if shared and not exists (
    select 1 from public.space_profiles where space_id = prog.space_id and profile_id = uid
  ) then
    raise exception 'new row for relation "certificates" violates constraint "certificate_needs_name"'
      using errcode = '23514';
  end if;
  update public.certificates
  set share_token = case
    when not shared then null
    else coalesce(share_token, replace(gen_random_uuid()::text, '-', ''))
  end
  where id = result.id
  returning * into result;
  return result;
end;
$$;

-- Public read behind a share token: the minimum the share page shows.
create function public.shared_certificate(target_space uuid, token text)
returns table (member_name text, program_title text, issued_at timestamptz, serial uuid)
language sql stable security definer set search_path = '' as $$
  select sp.display_name, p.title, c.issued_at, c.id
  from public.certificates c
  join public.products p on p.id = c.program_id
  join public.space_profiles sp on sp.space_id = p.space_id and sp.profile_id = c.profile_id
  where c.share_token = token and p.space_id = target_space and p.certificates;
$$;

revoke execute on function public.set_certificate_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_certificate_sharing(uuid, boolean) to authenticated, service_role;
revoke execute on function public.shared_certificate(uuid, text) from public;
grant execute on function public.shared_certificate(uuid, text) to anon, authenticated, service_role;
