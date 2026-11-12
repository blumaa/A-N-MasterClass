-- Launch 6 item 4: photos on community posts, one attachment per chat line (channels and DMs).
-- Files live in the private bucket `community`, apart from Studio `resources`: members upload here,
-- so the bucket itself caps size and types (a signed upload URL trusts the browser otherwise).
-- Folders: <space>/<community>/<channel>/ for feed photos and chat lines,
--          <space>/<community>/dm/<thread>/ for DM lines. A row may only point into its own folder.
-- Mirrors src/lib/storage/communityFiles.ts (types, sizes, folders, POST_PHOTOS_MAX) and
-- the fake repo.
-- Kajabi: https://help.kajabi.com/en/articles/17174430 (photos in posts, 40 MB there; ours are
-- resized in the browser first).

-- ---------------------------------------------------------------------------
-- Folders
-- ---------------------------------------------------------------------------

create function public.channel_folder(target_channel uuid) returns text
language sql stable security definer set search_path = '' as $$
  select public.product_space(c.community_id) || '/' || c.community_id || '/' || c.id || '/'
  from public.channels c where c.id = target_channel;
$$;

create function public.thread_folder(target_thread uuid) returns text
language sql stable security definer set search_path = '' as $$
  select public.product_space(t.community_id) || '/' || t.community_id || '/dm/' || t.id || '/'
  from public.dm_threads t where t.id = target_thread;
$$;

-- One object directly inside `folder`.
create function public.in_folder(path text, folder text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(starts_with(path, folder)
    and length(path) > length(folder)
    and strpos(substr(path, length(folder) + 1), '/') = 0, false);
$$;

-- ---------------------------------------------------------------------------
-- Post photos
-- ---------------------------------------------------------------------------

create table public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  path text not null unique,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index post_photos_post on public.post_photos (post_id, position);

create function public.post_photos_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.in_folder(new.path, public.channel_folder(public.post_channel(new.post_id))) then
    raise exception 'new row for relation "post_photos" violates constraint "post_photos_path"' using errcode = '23514';
  end if;
  if (select count(*) from public.post_photos p where p.post_id = new.post_id) >= 10 then
    raise exception 'new row for relation "post_photos" violates constraint "post_photos_max"' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger post_photos_check before insert on public.post_photos
  for each row execute function public.post_photos_check();

alter table public.post_photos enable row level security;

create policy post_photos_read on public.post_photos for select using (public.can_read_post(post_id));
-- The author adds photos while they may still post in the channel.
create policy post_photos_insert on public.post_photos for insert
  with check (exists (
    select 1 from public.posts p
    where p.id = post_id and p.author_id = auth.uid() and public.can_post_in(p.channel_id)
  ));
create policy post_photos_delete on public.post_photos for delete
  using (exists (
    select 1 from public.posts p
    where p.id = post_id and (p.author_id = auth.uid() or public.can_moderate_channel(p.channel_id))
  ));

-- ---------------------------------------------------------------------------
-- Chat attachments: one per line; a line needs text or a file.
-- ---------------------------------------------------------------------------

alter table public.messages
  add column attachment_path text unique,
  add column attachment_name text,
  add column attachment_type text,
  add column attachment_size bigint,
  add constraint messages_attachment check (
    (attachment_path is null and attachment_name is null and attachment_type is null and attachment_size is null)
    or (attachment_path is not null and length(trim(attachment_name)) between 1 and 255
        and length(attachment_type) > 0 and attachment_size > 0)
  );

alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check
  check (length(body) <= 4000 and (length(trim(body)) > 0 or attachment_path is not null));

create function public.messages_attachment_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.attachment_path is not null and not public.in_folder(new.attachment_path,
       case when new.channel_id is not null then public.channel_folder(new.channel_id)
            else public.thread_folder(new.thread_id) end) then
    raise exception 'new row for relation "messages" violates constraint "messages_attachment_path"' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger messages_attachment_check before insert or update on public.messages
  for each row execute function public.messages_attachment_check();

-- ---------------------------------------------------------------------------
-- Files of a channel, for Studio to remove them with the channel (rows cascade, objects do not).
-- ---------------------------------------------------------------------------

create function public.channel_files(target_channel uuid) returns setof text
language sql stable security definer set search_path = '' as $$
  select ph.path from public.post_photos ph join public.posts p on p.id = ph.post_id
  where p.channel_id = target_channel and public.can_edit_community(public.channel_community(target_channel))
  union all
  select m.attachment_path from public.messages m
  where m.channel_id = target_channel and m.attachment_path is not null
    and public.can_edit_community(public.channel_community(target_channel));
$$;
revoke execute on function public.channel_files(uuid) from public, anon;
grant execute on function public.channel_files(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, no object policies = service role only (signed URLs from the server)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 26214400, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv', 'application/zip',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg', 'audio/mp4', 'video/mp4'
])
on conflict (id) do nothing;
