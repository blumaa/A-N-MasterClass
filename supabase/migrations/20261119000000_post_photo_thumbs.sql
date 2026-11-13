-- Group 2 post photos: a small thumbnail beside each photo, made in the browser at upload
-- (no Storage image transformations: paid per image). The feed grid shows the thumbnail, opening
-- shows the photo. Null for GIFs and photos added before this; the route then serves the photo.
-- Mirrors src/lib/data/fake/fakeCommunityFiles.ts.

alter table public.post_photos add column thumb_path text unique;

-- Same folder rule for the thumbnail; the 10-photo cap only on insert.
create or replace function public.post_photos_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  folder text := public.channel_folder(public.post_channel(new.post_id));
begin
  if not public.in_folder(new.path, folder) or (new.thumb_path is not null and not public.in_folder(new.thumb_path, folder)) then
    raise exception 'new row for relation "post_photos" violates constraint "post_photos_path"' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.post_photos p where p.post_id = new.post_id) >= 10 then
    raise exception 'new row for relation "post_photos" violates constraint "post_photos_max"' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger post_photos_check on public.post_photos;
create trigger post_photos_check before insert or update of post_id, path, thumb_path on public.post_photos
  for each row execute function public.post_photos_check();

-- Storage cleanup (20261115000000): the thumbnail is one more path column.
create or replace function public.storage_columns() returns table (tbl text, col text, bucket text)
language sql immutable set search_path = '' as $$
  values
    ('parts', 'file_path', 'resources'),
    ('product_files', 'file_path', 'resources'),
    ('episodes', 'audio_path', 'resources'),
    ('post_photos', 'path', 'community'),
    ('post_photos', 'thumb_path', 'community'),
    ('messages', 'attachment_path', 'community'),
    ('products', 'cover_path', 'site'),
    ('space_branding', 'logo_path', 'site'),
    ('space_branding', 'favicon_path', 'site'),
    ('space_profiles', 'avatar_path', 'site');
$$;
revoke execute on function public.storage_columns() from public, anon, authenticated;

drop trigger post_photos_storage_trash on public.post_photos;
create trigger post_photos_storage_trash after delete or update of path, thumb_path on public.post_photos
  for each row execute function public.queue_storage_trash('community', 'path', 'thumb_path');
