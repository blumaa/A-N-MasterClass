-- Group 2 post photos: an optional thumbnail beside each photo, in the same folder, cleaned like the photo.
begin;
select plan(11);

delete from public.storage_trash;

do $$
declare
  s uuid := '33000000-0000-4000-8000-00000000000a';
  comm uuid := '33000000-0000-4000-8000-000000000c01';
  a uuid;
begin
  perform tests.create_supabase_user('thumb-owner');
  perform tests.create_supabase_user('thumb-author');
  a := tests.get_supabase_uid('thumb-author');
  insert into public.spaces (id, slug, name, status) values (s, 'sqltest-thumbs', 'SQL test', 'live');
  insert into public.space_members values (s, tests.get_supabase_uid('thumb-owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values (s, a, 'Author');
  insert into public.products (id, space_id, kind, slug, title, status) values (comm, s, 'community', 'community', 'C', 'published');
  insert into public.grants (product_id, profile_id, source) values (comm, a, 'manual');
  insert into public.channels (id, community_id, title, kind) values
    ('33000000-0000-4000-8000-000000000e01', comm, 'Feed', 'feed'),
    ('33000000-0000-4000-8000-000000000e02', comm, 'Other', 'feed');
  insert into public.posts (id, channel_id, author_id, body) values
    ('33000000-0000-4000-8000-000000000f01', '33000000-0000-4000-8000-000000000e01', a, 'post');
end $$;

create temp table f (feed text, other text) on commit drop;
insert into f values (public.channel_folder('33000000-0000-4000-8000-000000000e01'), public.channel_folder('33000000-0000-4000-8000-000000000e02'));
grant select on f to authenticated, service_role;

select has_column('public', 'post_photos', 'thumb_path', 'post_photos has thumb_path');
select ok(exists (select 1 from public.storage_columns() where tbl = 'post_photos' and col = 'thumb_path' and bucket = 'community'),
  'thumb_path is a community storage column');

select tests.authenticate_as('thumb-author');
select lives_ok(format($$ insert into public.post_photos (id, post_id, path, thumb_path) values
  ('33000000-0000-4000-8000-000000000101', '33000000-0000-4000-8000-000000000f01', '%1$s1-a.jpg', '%1$s2-a.jpg') $$, (select feed from f)),
  'author adds a photo with its thumbnail');
select lives_ok(format($$ insert into public.post_photos (post_id, path) values
  ('33000000-0000-4000-8000-000000000f01', '%s3-b.gif') $$, (select feed from f)),
  'a photo without thumbnail is fine');
select throws_ok(format($$ insert into public.post_photos (post_id, path, thumb_path) values
  ('33000000-0000-4000-8000-000000000f01', '%s4-c.jpg', '%s5-c.jpg') $$, (select feed from f), (select other from f)),
  '23514', null, 'thumbnail outside the post folder refused');
select throws_ok(format($$ insert into public.post_photos (post_id, path, thumb_path) values
  ('33000000-0000-4000-8000-000000000f01', '%1$s6-d.jpg', '%1$sx/7-d.jpg') $$, (select feed from f)),
  '23514', null, 'thumbnail in a sub folder refused');
select throws_ok(format($$ insert into public.post_photos (post_id, path, thumb_path) values
  ('33000000-0000-4000-8000-000000000f01', '%1$s8-e.jpg', '%1$s2-a.jpg') $$, (select feed from f)),
  '23505', null, 'thumbnail already used refused');

select tests.authenticate_as_service_role();
select throws_ok(format($$ update public.post_photos set thumb_path = '%s9-f.jpg'
  where id = '33000000-0000-4000-8000-000000000101' $$, (select other from f)),
  '23514', null, 'thumbnail moved outside the folder refused');

select tests.authenticate_as('thumb-author');
delete from public.post_photos where id = '33000000-0000-4000-8000-000000000101';
select tests.authenticate_as_service_role();
select results_eq(format($$ select path from public.storage_trash where bucket = 'community' order by path $$),
  format($$ values ('%1$s1-a.jpg'), ('%1$s2-a.jpg') $$, (select feed from f)),
  'removing a photo queues the photo and its thumbnail');

-- A queued thumbnail a row points at again leaves the queue instead of being removed.
insert into public.storage_trash (bucket, path) select 'community', feed || '3-b-thumb.jpg' from f;
update public.post_photos set thumb_path = (select feed from f) || '3-b-thumb.jpg' where path like '%3-b.gif';
select ok(not exists (select 1 from public.storage_trash_take() t, f where t.path = f.feed || '3-b-thumb.jpg'),
  'a thumbnail in use is not taken');

delete from public.posts where id = '33000000-0000-4000-8000-000000000f01';
select ok(exists (select 1 from public.storage_trash t, f where t.path = f.feed || '3-b-thumb.jpg'),
  'deleting the post queues the thumbnail');

select * from finish(true);
rollback;
