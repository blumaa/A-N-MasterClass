-- Space logo + favicon. space_branding.logo_path / favicon_path exist since the branding
-- migration; this pins both to the public `site` bucket: one object directly in the space folder
-- (<space>/site/<name>), same rule as isSiteImagePath in src/lib/storage/siteImages.ts.
alter table public.space_branding add constraint space_branding_logo_path
  check (logo_path is null or logo_path ~ ('^' || space_id::text || '/site/[^/]+$'));
alter table public.space_branding add constraint space_branding_favicon_path
  check (favicon_path is null or favicon_path ~ ('^' || space_id::text || '/site/[^/]+$'));
