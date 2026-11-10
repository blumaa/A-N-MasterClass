-- Site builder: pages + blog posts, publish snapshots, header/footer nav (G11, G25).
-- Section fields are validated in the app (src/lib/site/sections.ts); SQL guards the stored shape.
-- Drafts never reach visitors: public reads go through published_pages, which has no draft column.

-- Mirrors SECTION_KINDS (src/lib/site/sections.ts); sqlMirror.test.ts keeps them equal.
create function public.is_site_sections(s jsonb) returns boolean
language sql immutable
as $$
  select jsonb_typeof(s) = 'array'
    and coalesce((
      select bool_and(
        jsonb_typeof(e) = 'object'
        and jsonb_typeof(e -> 'id') = 'string'
        and e ->> 'kind' in ('hero', 'text', 'video', 'curriculum', 'testimonials', 'faq', 'cta')
        and jsonb_typeof(e -> 'hidden') = 'boolean'
        and jsonb_typeof(e -> 'fields') = 'object'
        and jsonb_typeof(e -> 'items') = 'array'
      )
      from jsonb_array_elements(s) as e
    ), true)
$$;

-- Nav links: label + site path or https URL (mirrors isSafeHref).
create function public.is_nav_items(n jsonb) returns boolean
language sql immutable
as $$
  select jsonb_typeof(n) = 'array'
    and coalesce((
      select bool_and(
        jsonb_typeof(e -> 'label') = 'string'
        and length(trim(e ->> 'label')) > 0
        and jsonb_typeof(e -> 'href') = 'string'
        and (e ->> 'href' ~ '^/([^/]|$)' or e ->> 'href' ~ '^https://')
      )
      from jsonb_array_elements(n) as e
    ), true)
$$;

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- Mirrors PAGE_KINDS / LEGAL_KINDS (src/lib/data/types.ts).
  kind text not null default 'page' constraint pages_kind check (kind in ('page', 'post')),
  slug text not null constraint pages_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  title text not null check (length(trim(title)) > 0),
  is_home boolean not null default false,
  legal_kind text constraint pages_legal_kind check (legal_kind in ('imprint', 'privacy', 'terms')),
  seo_title text,
  seo_description text,
  draft jsonb not null default '[]' check (public.is_site_sections(draft)),
  published jsonb check (published is null or public.is_site_sections(published)),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, kind, slug),
  constraint pages_home_is_page check (not is_home or kind = 'page'),
  constraint pages_legal_is_page check (legal_kind is null or kind = 'page'),
  constraint pages_published_at check ((published is null) = (published_at is null))
);

create unique index pages_one_home on public.pages (space_id) where is_home;
create unique index pages_one_legal_kind on public.pages (space_id, legal_kind) where legal_kind is not null;

create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  sections jsonb not null check (public.is_site_sections(sections)),
  published_at timestamptz not null default now()
);

create index page_versions_page on public.page_versions (page_id, published_at desc);

create table public.site_nav (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  header jsonb not null default '[]' check (public.is_nav_items(header)),
  footer jsonb not null default '[]' check (public.is_nav_items(footer)),
  updated_at timestamptz not null default now()
);

alter table public.pages enable row level security;
alter table public.page_versions enable row level security;
alter table public.site_nav enable row level security;

-- Base table: editors only (drafts included).
create policy pages_edit on public.pages for all
  using (public.has_capability(space_id, 'site.edit'))
  with check (public.has_capability(space_id, 'site.edit'));

create policy page_versions_edit on public.page_versions for all
  using (public.has_capability((select p.space_id from public.pages p where p.id = page_id), 'site.edit'))
  with check (public.has_capability((select p.space_id from public.pages p where p.id = page_id), 'site.edit'));

-- Public site: published pages only, without the draft column. Owner-privileged view
-- (no security_invoker) so visitors read it without any policy on the base table.
create view public.published_pages with (security_barrier = true) as
  select id, space_id, kind, slug, title, is_home, legal_kind, seo_title, seo_description, published, published_at
  from public.pages
  where published is not null;

grant select on public.published_pages to anon, authenticated;

create policy site_nav_read on public.site_nav for select using (true);
create policy site_nav_write on public.site_nav for all
  using (public.has_capability(space_id, 'site.edit'))
  with check (public.has_capability(space_id, 'site.edit'));
