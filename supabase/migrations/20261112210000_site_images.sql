-- Photos on site pages (hero, image + text, about me, cards) and new section kinds.
-- Bucket `site` is public: site pages are public, so images load by plain URL (and next/image).
-- No object policies: browsers cannot list or write. Uploads use a signed upload URL made on the
-- server after the site.edit check (src/lib/storage/requestSiteImageUpload.ts).
-- Folder per space: <space>/site/<id>-<name>. Mirrors src/lib/storage/siteImages.ts (types, size).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Mirrors SECTION_KINDS (src/lib/site/sections.ts); sqlMirror.test.ts keeps them equal.
create or replace function public.is_site_sections(s jsonb) returns boolean
language sql immutable
as $$
  select jsonb_typeof(s) = 'array'
    and coalesce((
      select bool_and(
        jsonb_typeof(e) = 'object'
        and jsonb_typeof(e -> 'id') = 'string'
        and e ->> 'kind' in ('hero', 'text', 'imageText', 'bio', 'cards', 'highlights', 'video', 'curriculum', 'offer', 'testimonials', 'faq', 'cta')
        and jsonb_typeof(e -> 'hidden') = 'boolean'
        and jsonb_typeof(e -> 'fields') = 'object'
        and jsonb_typeof(e -> 'items') = 'array'
      )
      from jsonb_array_elements(s) as e
    ), true)
$$;
