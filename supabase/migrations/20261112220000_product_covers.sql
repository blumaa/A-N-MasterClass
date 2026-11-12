-- Product cover images for library cards and tiles. products.cover_path exists since the programs
-- migration; this pins it to the public `site` bucket: one object directly in the space folder
-- (<space>/site/<name>), same rule as isSiteImagePath in src/lib/storage/siteImages.ts.
alter table public.products add constraint products_cover_path
  check (cover_path is null or cover_path ~ ('^' || space_id::text || '/site/[^/]+$'));
