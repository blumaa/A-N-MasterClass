-- Per-space branding + per-program colour override (plan: Branding, G20 manifest colours).
-- Contrast is proved in the app (src/features/branding/contrast.ts) before save; SQL guards shape
-- so nothing but #rrggbb ever reaches the runtime <style> tag.

-- Mirrors BRAND_INPUTS (src/tokens/brandInputs.ts); sqlMirror.test.ts keeps them equal.
create function public.is_brand_colors(c jsonb) returns boolean
language sql immutable
as $$
  select jsonb_typeof(c) = 'object'
    and (select count(*) from jsonb_object_keys(c)) = 7
    and (
      select bool_and(c ? k and c ->> k ~ '^#[0-9a-fA-F]{6}$')
      from unnest(array['accent', 'accent-soft', 'page', 'card', 'hairline', 'mid', 'ink']) as k
    )
$$;

create table public.space_branding (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  colors jsonb check (colors is null or public.is_brand_colors(colors)),
  logo_path text,
  favicon_path text,
  -- Mirrors FONT_IDS (src/lib/fonts/catalog.ts).
  font_heading text check (font_heading in ('inter', 'dm-sans', 'source-sans-3', 'lora', 'playfair-display', 'fraunces')),
  font_body text check (font_body in ('inter', 'dm-sans', 'source-sans-3', 'lora', 'playfair-display', 'fraunces')),
  updated_at timestamptz not null default now()
);

alter table public.products
  add constraint products_theme_override_shape
  check (theme_override is null or public.is_brand_colors(theme_override));

alter table public.space_branding enable row level security;

-- Every visitor (anon included) is painted with the space brand.
create policy space_branding_read on public.space_branding for select using (true);
create policy space_branding_write on public.space_branding for all
  using (public.has_capability(space_id, 'branding.manage'))
  with check (public.has_capability(space_id, 'branding.manage'));
