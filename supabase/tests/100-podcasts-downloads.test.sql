-- Launch 5: podcast + download products. Shape guards, episode visibility (published only for
-- holders), files for holders, per-listener feed tokens (create, reset, service-role lookup).
begin;
select plan(21);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  pod uuid := 'd1000000-0000-4000-8000-000000000001';
  dl uuid := 'd1000000-0000-4000-8000-000000000002';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('member');
  perform tests.create_supabase_user('outsider');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live');
  insert into public.space_members values (a, tests.get_supabase_uid('owner'), 'owner', now());
  insert into public.products (id, space_id, kind, slug, title, status) values
    (pod, a, 'podcast', 'show', 'Show', 'published'),
    (dl, a, 'download', 'pack', 'Pack', 'published');
  insert into public.grants (product_id, profile_id, source) values
    (pod, tests.get_supabase_uid('member'), 'manual'),
    (dl, tests.get_supabase_uid('member'), 'manual');
  insert into public.episodes (product_id, title, audio_path, audio_bytes, publish_at) values
    (pod, 'Live', 'a/live.mp3', 1000, now() - interval '1 day'),
    (pod, 'Later', 'a/later.mp3', 1000, now() + interval '1 day'),
    (pod, 'Draft', 'a/draft.mp3', 1000, null);
  insert into public.product_files (product_id, title, file_path, size_bytes) values (dl, 'Workbook', 'a/workbook.pdf', 10);
end $$;

-- Shape guards
select throws_ok($$ insert into public.episodes (product_id, title, audio_path, audio_bytes)
  values ('d1000000-0000-4000-8000-000000000002', 'x', 'x.mp3', 1) $$, '23514', null, 'episodes only on podcast products');
select throws_ok($$ insert into public.product_files (product_id, title, file_path, size_bytes)
  values ('d1000000-0000-4000-8000-000000000001', 'x', 'x.pdf', 1) $$, '23514', null, 'files only on download products');
select throws_ok($$ insert into public.podcast_settings (product_id)
  values ('d1000000-0000-4000-8000-000000000002') $$, '23514', null, 'podcast settings only on podcast products');
select throws_ok($$ update public.episodes set audio_path = 'a/x.wav' $$, '23514', null, 'episode audio must be mp3');
select throws_ok($$ update public.episodes set audio_bytes = 262144001 $$, '23514', null, 'episode at most 250 MB');
select throws_ok($$ update public.episodes set season = 0 $$, '23514', null, 'season starts at 1');
select throws_ok($$ update public.episodes set title = '  ' $$, '23514', null, 'episode title required');
select throws_ok($$ update public.product_files set size_bytes = 0 $$, '23514', null, 'file size must be positive');
select throws_ok($$ insert into public.podcast_settings (product_id, author)
  values ('d1000000-0000-4000-8000-000000000001', repeat('a', 201)) $$, '23514', null, 'author at most 200 chars');

-- Holder: published episodes only, files, own feed token
select tests.authenticate_as('member');
select results_eq($$ select title from public.episodes order by title $$, $$ values ('Live'::text) $$,
  'holder sees published episodes only');
select results_eq($$ select title from public.product_files $$, $$ values ('Workbook'::text) $$, 'holder sees files');
select is(public.podcast_feed_token('d1000000-0000-4000-8000-000000000001'),
  public.podcast_feed_token('d1000000-0000-4000-8000-000000000001'), 'feed token is stable');
select set_config('tests.old_token', public.podcast_feed_token('d1000000-0000-4000-8000-000000000001'), true);
select set_config('tests.new_token', public.reset_podcast_feed('d1000000-0000-4000-8000-000000000001'), true);
select isnt(current_setting('tests.new_token'), current_setting('tests.old_token'), 'reset replaces the token');
select ok((select count(*) from public.podcast_feeds) = 1, 'one feed row per listener');
select throws_ok($$ select public.podcast_feed('anything') $$, '42501', null, 'clients cannot look up feeds by token');

-- Outsider: nothing, no token
select tests.authenticate_as('outsider');
select is_empty($$ select 1 from public.episodes union all select 1 from public.product_files $$,
  'outsider sees no episodes or files');
select throws_ok($$ select public.podcast_feed_token('d1000000-0000-4000-8000-000000000001') $$, '23514', null,
  'feed token needs an active grant');

-- Owner sees drafts and scheduled episodes
select tests.authenticate_as('owner');
select results_eq($$ select count(*)::int from public.episodes $$, $$ values (3) $$, 'staff see every episode');

-- Service role: token lookup, old token dead, revoked grant ends the feed
select tests.authenticate_as_service_role();
select is_empty(format('select 1 from public.podcast_feed(%L)', current_setting('tests.old_token')), 'old token no longer works');
select results_eq(format('select count(*)::int from public.podcast_feed(%L)', current_setting('tests.new_token')),
  $$ values (1) $$, 'service role finds the feed by token');
update public.grants set status = 'revoked' where product_id = 'd1000000-0000-4000-8000-000000000001';
select is_empty(format('select 1 from public.podcast_feed(%L)', current_setting('tests.new_token')), 'feed ends with the grant');

select * from finish(true);
rollback;
