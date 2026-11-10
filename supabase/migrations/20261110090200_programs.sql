-- Products, grants, program tree, progress (G6, G7, G8, G13, G18).
-- Step access rules mirror src/lib/programs/access.ts (lock + drip).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null check (kind in ('program', 'community', 'coaching', 'podcast', 'download')),
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  title text not null check (length(trim(title)) > 0),
  subtitle text,
  cover_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  theme_override jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (space_id, slug)
);

create table public.programs (
  product_id uuid primary key references public.products (id) on delete cascade,
  community_product_id uuid references public.products (id) on delete set null
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (product_id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  unlock_after_step_id uuid,
  release_after_days integer check (release_after_days >= 0),
  release_at timestamptz,
  created_at timestamptz not null default now()
);
create index modules_program on public.modules (program_id, position);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);
create index steps_module on public.steps (module_id, position);

alter table public.modules
  add constraint modules_unlock_after_step_fk
  foreign key (unlock_after_step_id) references public.steps (id) on delete set null;

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.steps (id) on delete cascade,
  kind text not null check (kind in ('video', 'text', 'download', 'image', 'embed')),
  title text,
  position integer not null default 0,
  body jsonb,
  vimeo_id text check (vimeo_id ~ '^[0-9]+$'),
  aspect numeric check (aspect > 0),
  duration_s integer check (duration_s >= 0),
  poster_path text,
  file_path text,
  file_size bigint check (file_size >= 0),
  created_at timestamptz not null default now(),
  constraint parts_video_has_id check (kind <> 'video' or vimeo_id is not null),
  constraint parts_download_has_file check (kind <> 'download' or file_path is not null)
);
create index parts_step on public.parts (step_id, position);

create table public.grants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  access_group_id uuid,
  source text not null check (source in ('purchase', 'manual', 'free')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);
create unique index grants_one_active on public.grants (product_id, profile_id) where status = 'active';
create index grants_profile on public.grants (profile_id);

create table public.step_progress (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (profile_id, step_id)
);

create table public.video_position (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  part_id uuid not null references public.parts (id) on delete cascade,
  last_position_s integer not null check (last_position_s >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, part_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.product_space(target_product uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.space_id from public.products p where p.id = target_product;
$$;

create function public.active_grant_at(target_product uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select g.granted_at from public.grants g
  where g.product_id = target_product and g.profile_id = auth.uid() and g.status = 'active'
    and (g.expires_at is null or g.expires_at > now());
$$;

create function public.has_grant(target_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.active_grant_at(target_product) is not null;
$$;

-- Staff of the space, or holder of any active grant in it.
create function public.is_space_participant(target_space uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_space_staff(target_space) or exists (
    select 1 from public.grants g join public.products p on p.id = g.product_id
    where p.space_id = target_space and g.profile_id = auth.uid() and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
  );
$$;

-- G7 lock + G8 drip, for the caller. Staff with products.edit always pass (preview).
create function public.can_read_step(target_step uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with s as (
    select st.status as step_status, m.status as module_status, pr.status as product_status,
           pr.id as product_id, pr.space_id, m.unlock_after_step_id, m.release_after_days, m.release_at
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
      and (s.release_after_days is null
           or public.active_grant_at(s.product_id) + make_interval(days => s.release_after_days) <= now())
      and (s.release_at is null or s.release_at <= now())
    )
    from s
  ), false);
$$;

-- Caller's progress over published steps of published modules (G6).
create function public.program_progress(target_program uuid)
returns table (completed integer, total integer)
language sql stable security invoker set search_path = '' as $$
  select count(sp.step_id)::integer, count(st.id)::integer
  from public.steps st
  join public.modules m on m.id = st.module_id
  left join public.step_progress sp on sp.step_id = st.id and sp.profile_id = auth.uid()
  where m.program_id = target_program and m.status = 'published' and st.status = 'published';
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.programs enable row level security;
alter table public.modules enable row level security;
alter table public.steps enable row level security;
alter table public.parts enable row level security;
alter table public.grants enable row level security;
alter table public.step_progress enable row level security;
alter table public.video_position enable row level security;
alter table public.space_profiles enable row level security;

-- Catalogue + outline are public once published (sales page curriculum, G11). Content (parts) is not.
create policy products_read on public.products for select
  using (status = 'published' or public.has_capability(space_id, 'products.edit'));
create policy products_write on public.products for all
  using (public.has_capability(space_id, 'products.edit'))
  with check (public.has_capability(space_id, 'products.edit'));

create policy programs_read on public.programs for select
  using (exists (select 1 from public.products p where p.id = product_id));
create policy programs_write on public.programs for all
  using (public.has_capability(public.product_space(product_id), 'products.edit'))
  with check (public.has_capability(public.product_space(product_id), 'products.edit'));

create policy modules_read on public.modules for select
  using (
    (status = 'published' and exists (select 1 from public.products p where p.id = program_id))
    or public.has_capability(public.product_space(program_id), 'products.edit')
  );
create policy modules_write on public.modules for all
  using (public.has_capability(public.product_space(program_id), 'products.edit'))
  with check (public.has_capability(public.product_space(program_id), 'products.edit'));

create policy steps_read on public.steps for select
  using (exists (select 1 from public.modules m where m.id = module_id)
         and (status = 'published' or public.has_capability(
           public.product_space((select m.program_id from public.modules m where m.id = module_id)),
           'products.edit')));
create policy steps_write on public.steps for all
  using (public.has_capability(
    public.product_space((select m.program_id from public.modules m where m.id = module_id)), 'products.edit'))
  with check (public.has_capability(
    public.product_space((select m.program_id from public.modules m where m.id = module_id)), 'products.edit'));

create function public.step_space(target_step uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select pr.space_id from public.steps st
  join public.modules m on m.id = st.module_id
  join public.products pr on pr.id = m.program_id
  where st.id = target_step;
$$;

create policy parts_read on public.parts for select using (public.can_read_step(step_id));
create policy parts_write on public.parts for all
  using (public.has_capability(public.step_space(step_id), 'products.edit'))
  with check (public.has_capability(public.step_space(step_id), 'products.edit'));

-- Grants: own rows; customers.manage sees + issues manual grants. Purchases come via fulfil_order (phase 5).
create policy grants_read on public.grants for select
  using (profile_id = auth.uid() or public.has_capability(public.product_space(product_id), 'customers.manage'));
create policy grants_insert on public.grants for insert
  with check (source in ('manual', 'free')
              and public.has_capability(public.product_space(product_id), 'customers.manage'));
create policy grants_update on public.grants for update
  using (public.has_capability(public.product_space(product_id), 'customers.manage'))
  with check (public.has_capability(public.product_space(product_id), 'customers.manage'));

-- Progress: own, only on readable steps; un-tick allowed (G7). Staff read for Customers view.
create policy step_progress_read on public.step_progress for select
  using (profile_id = auth.uid()
         or public.has_capability(public.step_space(step_id), 'customers.manage')
         or public.has_capability(public.step_space(step_id), 'analytics.view'));
create policy step_progress_insert on public.step_progress for insert
  with check (profile_id = auth.uid() and public.can_read_step(step_id));
create policy step_progress_delete on public.step_progress for delete
  using (profile_id = auth.uid());

create policy video_position_own on public.video_position for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid()
              and public.can_read_step((select pt.step_id from public.parts pt where pt.id = part_id)));

-- space_profiles: visible inside the space only (G2); own row writable.
create policy space_profiles_read on public.space_profiles for select
  using (public.is_space_participant(space_id) or public.is_platform_admin());
create policy space_profiles_insert on public.space_profiles for insert
  with check (profile_id = auth.uid() and public.is_space_participant(space_id));
create policy space_profiles_update on public.space_profiles for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
