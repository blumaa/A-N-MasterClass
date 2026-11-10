-- Tenancy: spaces, domains, profiles, staff roles, capability matrix (G1, G2, G15, G17).
-- SSOT mirrors: slug rules = src/lib/tenancy/slug.ts, matrix = src/lib/auth/capabilities.ts
-- (both checked by src/lib/db/sqlMirror.test.ts).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    constraint spaces_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')
    constraint spaces_slug_reserved check (slug not in ('www', 'staging', 'platform', 'api')),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  locale text not null default 'en',
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.space_domains (
  host text primary key check (host = lower(host)),
  space_id uuid not null references public.spaces (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index space_domains_one_primary on public.space_domains (space_id) where is_primary;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.space_profiles (
  space_id uuid not null references public.spaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  avatar_path text,
  bio text,
  created_at timestamptz not null default now(),
  primary key (space_id, profile_id)
);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'assistant', 'support')),
  created_at timestamptz not null default now(),
  primary key (space_id, profile_id)
);
create index space_members_profile on public.space_members (profile_id);

create table public.role_capabilities (
  role text not null check (role in ('owner', 'admin', 'assistant', 'support')),
  capability text not null,
  primary key (role, capability)
);

insert into public.role_capabilities (role, capability) values
  ('owner', 'products.edit'), ('owner', 'site.edit'), ('owner', 'branding.manage'),
  ('owner', 'offers.manage'), ('owner', 'customers.manage'), ('owner', 'community.moderate'),
  ('owner', 'comments.moderate'), ('owner', 'analytics.view'), ('owner', 'settings.manage'),
  ('owner', 'staff.manage'), ('owner', 'payments.manage'), ('owner', 'api_keys.manage'),
  ('admin', 'products.edit'), ('admin', 'site.edit'), ('admin', 'branding.manage'),
  ('admin', 'offers.manage'), ('admin', 'customers.manage'), ('admin', 'community.moderate'),
  ('admin', 'comments.moderate'), ('admin', 'analytics.view'), ('admin', 'settings.manage'),
  ('admin', 'staff.manage'),
  ('assistant', 'products.edit'), ('assistant', 'site.edit'), ('assistant', 'community.moderate'),
  ('assistant', 'comments.moderate'),
  ('support', 'customers.manage'), ('support', 'comments.moderate');

-- ---------------------------------------------------------------------------
-- Helpers. Definer + empty search_path: policies call them without recursing into RLS.
-- ---------------------------------------------------------------------------

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create function public.space_role(target_space uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.space_members m
  where m.space_id = target_space and m.profile_id = auth.uid();
$$;

create function public.has_capability(target_space uuid, cap text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.space_members m
    join public.role_capabilities rc on rc.role = m.role
    where m.space_id = target_space and m.profile_id = auth.uid() and rc.capability = cap
  );
$$;

create function public.is_space_staff(target_space uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.space_role(target_space) is not null;
$$;

-- Profile row for every auth user. Email kept in sync on insert only; change flow updates both.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.spaces enable row level security;
alter table public.space_domains enable row level security;
alter table public.profiles enable row level security;
alter table public.space_profiles enable row level security;
alter table public.space_members enable row level security;
alter table public.role_capabilities enable row level security;

-- spaces: live = public site; staff see own; platform admin creates (G1).
create policy spaces_read on public.spaces for select
  using (status = 'live' or public.is_space_staff(id) or public.is_platform_admin());
create policy spaces_insert on public.spaces for insert
  with check (public.is_platform_admin());
create policy spaces_update on public.spaces for update
  using (public.has_capability(id, 'settings.manage') or public.is_platform_admin())
  with check (public.has_capability(id, 'settings.manage') or public.is_platform_admin());
create policy spaces_delete on public.spaces for delete
  using (public.is_platform_admin());

-- space_domains: host lookup is public; only platform admin attaches (G17, v1 by hand).
create policy space_domains_read on public.space_domains for select using (true);
create policy space_domains_write on public.space_domains for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- profiles: own row only; email never leaks across spaces (G2).
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_platform_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- is_platform_admin cannot be self-granted.
revoke update on public.profiles from anon, authenticated;
grant update (email) on public.profiles to authenticated;

-- space_members: staff see their space's staff; owner role only by owner.
create policy space_members_read on public.space_members for select
  using (profile_id = auth.uid() or public.is_space_staff(space_id) or public.is_platform_admin());
create policy space_members_insert on public.space_members for insert
  with check (
    public.is_platform_admin()
    or (public.has_capability(space_id, 'staff.manage')
        and (role <> 'owner' or public.space_role(space_id) = 'owner'))
  );
create policy space_members_update on public.space_members for update
  using (public.is_platform_admin() or public.has_capability(space_id, 'staff.manage'))
  with check (
    public.is_platform_admin()
    or (public.has_capability(space_id, 'staff.manage')
        and (role <> 'owner' or public.space_role(space_id) = 'owner'))
  );
create policy space_members_delete on public.space_members for delete
  using (
    public.is_platform_admin()
    or (public.has_capability(space_id, 'staff.manage')
        and (role <> 'owner' or public.space_role(space_id) = 'owner'))
  );

-- role_capabilities: readable matrix, no writes from clients.
create policy role_capabilities_read on public.role_capabilities for select using (true);
