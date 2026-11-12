-- Launch 6 item 4: post photos and chat attachments stay in their folder, follow post/chat access.
begin;
select plan(19);

do $$
declare
  s uuid := '14141414-1414-4414-8414-141414141414';
  comm uuid := 'c1400000-0000-4000-8000-000000000001';
  a uuid;
  b uuid;
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('author');
  perform tests.create_supabase_user('other');
  perform tests.create_supabase_user('stranger');
  a := tests.get_supabase_uid('author');
  b := tests.get_supabase_uid('other');
  insert into public.spaces (id, slug, name, status) values (s, 'sqltest-community-files', 'SQL test', 'live');
  insert into public.space_members values (s, tests.get_supabase_uid('owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('owner'), 'Owner'), (s, a, 'Author'), (s, b, 'Other');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, s, 'community', 'community', 'Community', 'published');
  insert into public.grants (product_id, profile_id, source) values (comm, a, 'manual'), (comm, b, 'manual');
  insert into public.channels (id, community_id, title, kind, position) values
    ('e1400000-0000-4000-8000-000000000001', comm, 'Feed', 'feed', 0),
    ('e1400000-0000-4000-8000-000000000002', comm, 'Chat', 'chat', 1);
  insert into public.posts (id, channel_id, author_id, body) values
    ('f1400000-0000-4000-8000-000000000001', 'e1400000-0000-4000-8000-000000000001', a, 'post'),
    ('f1400000-0000-4000-8000-000000000002', 'e1400000-0000-4000-8000-000000000001', a, 'second');
  insert into public.dm_threads (id, community_id, a_id, b_id) values
    ('d1400000-0000-4000-8000-000000000001', comm, least(a, b), greatest(a, b));
end $$;

create temp table f (feed text, chat text, dm text) on commit drop;
insert into f values (
  '14141414-1414-4414-8414-141414141414/c1400000-0000-4000-8000-000000000001/e1400000-0000-4000-8000-000000000001/',
  '14141414-1414-4414-8414-141414141414/c1400000-0000-4000-8000-000000000001/e1400000-0000-4000-8000-000000000002/',
  '14141414-1414-4414-8414-141414141414/c1400000-0000-4000-8000-000000000001/dm/d1400000-0000-4000-8000-000000000001/'
);
grant select on f to authenticated;

select is((select feed from f), public.channel_folder('e1400000-0000-4000-8000-000000000001'), 'channel folder');
select is((select dm from f), public.thread_folder('d1400000-0000-4000-8000-000000000001'), 'thread folder');
select ok(public.in_folder('a/b/x.jpg', 'a/b/') and not public.in_folder('a/b/c/x.jpg', 'a/b/')
  and not public.in_folder('a/b/', 'a/b/') and not public.in_folder('z/b/x.jpg', 'a/b/'), 'in_folder: one object directly inside');

-- Post photos
select tests.authenticate_as('author');
select lives_ok(format($$ insert into public.post_photos (id, post_id, path, position) values
  ('a1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000001', '%s1-a.jpg', 0) $$, (select feed from f)),
  'author adds a photo in the channel folder');
select throws_ok(format($$ insert into public.post_photos (post_id, path) values
  ('f1400000-0000-4000-8000-000000000001', '%s1-a.jpg') $$, (select chat from f)),
  '23514', null, 'photo outside the post folder refused');
select throws_ok(format($$ insert into public.post_photos (post_id, path) values
  ('f1400000-0000-4000-8000-000000000001', '%sx/1-a.jpg') $$, (select feed from f)),
  '23514', null, 'photo in a sub folder refused');
select lives_ok(format($$ insert into public.post_photos (post_id, path, position)
  select 'f1400000-0000-4000-8000-000000000001', '%s' || n || '-b.jpg', n from generate_series(1, 9) n $$, (select feed from f)),
  'author fills ten photos');
select throws_ok(format($$ insert into public.post_photos (post_id, path) values
  ('f1400000-0000-4000-8000-000000000001', '%s11-b.jpg') $$, (select feed from f)),
  '23514', null, 'eleventh photo refused');

select tests.authenticate_as('other');
select results_eq($$ select count(*)::int from public.post_photos where post_id = 'f1400000-0000-4000-8000-000000000001' $$,
  $$ values (10) $$, 'member reads the photos');
select throws_ok(format($$ insert into public.post_photos (post_id, path) values
  ('f1400000-0000-4000-8000-000000000002', '%s12-c.jpg') $$, (select feed from f)),
  '42501', null, 'only the author adds photos');
delete from public.post_photos where id = 'a1400000-0000-4000-8000-000000000001';
select results_eq($$ select count(*)::int from public.post_photos where id = 'a1400000-0000-4000-8000-000000000001' $$,
  $$ values (1) $$, 'others do not delete photos');

select tests.authenticate_as('stranger');
select is_empty($$ select 1 from public.post_photos where post_id = 'f1400000-0000-4000-8000-000000000001' $$,
  'stranger reads no photos');

select tests.authenticate_as('author');
delete from public.post_photos where id = 'a1400000-0000-4000-8000-000000000001';
select is_empty($$ select 1 from public.post_photos where id = 'a1400000-0000-4000-8000-000000000001' $$,
  'author removes a photo');

-- Chat attachments
select lives_ok(format($$ insert into public.messages (id, channel_id, author_id, body, attachment_path, attachment_name, attachment_type, attachment_size)
  values ('b1400000-0000-4000-8000-000000000001', 'e1400000-0000-4000-8000-000000000002', auth.uid(), '', '%s1-notes.pdf', 'Notes.pdf', 'application/pdf', 1200) $$,
  (select chat from f)), 'file-only chat line');
select throws_ok($$ insert into public.messages (channel_id, author_id, body)
  values ('e1400000-0000-4000-8000-000000000002', auth.uid(), '  ') $$, '23514', null, 'empty line without a file refused');
select throws_ok(format($$ insert into public.messages (channel_id, author_id, body, attachment_path, attachment_name, attachment_type, attachment_size)
  values ('e1400000-0000-4000-8000-000000000002', auth.uid(), 'x', '%s2-a.pdf', 'a.pdf', 'application/pdf', 1) $$,
  (select dm from f)), '23514', null, 'channel line with a DM folder file refused');
select throws_ok(format($$ insert into public.messages (channel_id, author_id, body, attachment_path)
  values ('e1400000-0000-4000-8000-000000000002', auth.uid(), 'x', '%s3-a.pdf') $$,
  (select chat from f)), '23514', null, 'attachment needs name, type and size');
select lives_ok(format($$ insert into public.messages (id, thread_id, author_id, body, attachment_path, attachment_name, attachment_type, attachment_size)
  values ('b1400000-0000-4000-8000-000000000002', 'd1400000-0000-4000-8000-000000000001', auth.uid(), 'hi', '%s1-p.jpg', 'p.jpg', 'image/jpeg', 99) $$,
  (select dm from f)), 'DM line with a file in the thread folder');

select tests.authenticate_as('stranger');
select is_empty($$ select 1 from public.messages where id in
  ('b1400000-0000-4000-8000-000000000001', 'b1400000-0000-4000-8000-000000000002') $$, 'stranger reads no attachments');

select * from finish(true);
rollback;
