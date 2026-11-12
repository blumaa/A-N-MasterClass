-- Site images: public bucket limits and the new section kinds.
begin;
select plan(6);

select is((select public from storage.buckets where id = 'site'), true, 'site bucket is public');
select is((select file_size_limit from storage.buckets where id = 'site'), 10485760::bigint, 'site bucket caps 10 MB');
select is((select allowed_mime_types from storage.buckets where id = 'site'),
  array['image/jpeg', 'image/png', 'image/webp'], 'site bucket takes images only');
select ok(public.is_site_sections('[{"id":"a","kind":"bio","hidden":false,"fields":{},"items":[]}]'), 'bio kind accepted');
select ok(public.is_site_sections('[{"id":"a","kind":"cards","hidden":false,"fields":{},"items":[{"title":"x"}]}]'), 'cards kind accepted');
select ok(not public.is_site_sections('[{"id":"a","kind":"gallery","hidden":false,"fields":{},"items":[]}]'), 'unknown kind refused');

select * from finish(true);
rollback;
