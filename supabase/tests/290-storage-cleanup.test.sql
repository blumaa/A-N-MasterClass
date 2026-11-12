-- Storage cleanup: deletes and path changes queue the old path, cascades from a space, community or
-- profile reach the queue, the orphan sweep queues unreferenced objects past the grace period,
-- take skips paths in use again, Vault secrets leave with payment credentials. Service role only.
begin;
select plan(29);

-- Start from an empty queue: other suites and contract tests leave rows on the shared project.
delete from public.storage_trash;

do $$
declare
  a uuid := '29000000-0000-4000-8000-00000000000a';
  b uuid := '29000000-0000-4000-8000-00000000000b';
  comm uuid := '29000000-0000-4000-8000-000000000c01';
  prog uuid := '29000000-0000-4000-8000-000000000a01';
  pod uuid := '29000000-0000-4000-8000-000000000a02';
  dl uuid := '29000000-0000-4000-8000-000000000a03';
  modl uuid := '29000000-0000-4000-8000-000000000b01';
  stp uuid := '29000000-0000-4000-8000-000000000d01';
  feed uuid := '29000000-0000-4000-8000-000000000e01';
  post uuid := '29000000-0000-4000-8000-000000000f01';
  thread uuid := '29000000-0000-4000-8000-000000000101';
  offer uuid := '29000000-0000-4000-8000-000000000201';
  member uuid;
  friend uuid;
begin
  perform tests.create_supabase_user('trash-owner');
  perform tests.create_supabase_user('trash-member');
  perform tests.create_supabase_user('trash-friend');
  member := tests.get_supabase_uid('trash-member');
  friend := tests.get_supabase_uid('trash-friend');
  insert into public.spaces (id, slug, name, status) values (a, 'trash-a', 'A', 'live'), (b, 'trash-b', 'B', 'live');
  insert into public.space_members values (a, tests.get_supabase_uid('trash-owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name, avatar_path) values
    (a, member, 'Member', a || '/avatars/' || member || '/m.png'), (a, friend, 'Friend', a || '/avatars/' || friend || '/f.png'),
    (b, member, 'Member B', b || '/avatars/' || member || '/m.png');
  insert into public.space_branding (space_id, logo_path, favicon_path) values (a, a || '/site/logo.png', a || '/site/fav.png');
  insert into public.products (id, space_id, kind, slug, title, status, cover_path) values
    (comm, a, 'community', 'community', 'Community', 'published', a || '/site/comm.png'),
    (prog, a, 'program', 'rope-1', 'Rope 1', 'published', null),
    (pod, a, 'podcast', 'pod', 'Pod', 'published', null),
    (dl, a, 'download', 'dl', 'DL', 'published', null);
  insert into public.modules (id, program_id, title, status) values (modl, prog, 'M', 'published');
  insert into public.steps (id, module_id, title, status) values (stp, modl, 'Intro', 'published');
  insert into public.parts (step_id, kind, file_path) values (stp, 'download', a || '/' || prog || '/part.pdf');
  insert into public.episodes (product_id, title, audio_path, audio_bytes) values (pod, 'E1', a || '/' || pod || '/e1.mp3', 10);
  insert into public.product_files (product_id, title, file_path, size_bytes) values (dl, 'F', a || '/' || dl || '/f.zip', 10);
  insert into public.grants (product_id, profile_id, source) values (comm, member, 'manual'), (comm, friend, 'manual');
  insert into public.channels (id, community_id, title) values (feed, comm, 'General');
  insert into public.posts (id, channel_id, author_id, body) values (post, feed, member, 'mine');
  insert into public.post_photos (post_id, path) values (post, public.channel_folder(feed) || 'p.png');
  insert into public.dm_threads (id, community_id, a_id, b_id) values (thread, comm, least(member, friend), greatest(member, friend));
  insert into public.messages (thread_id, author_id, body, attachment_path, attachment_name, attachment_type, attachment_size)
    values (thread, friend, 'file', public.thread_folder(thread) || 'f.pdf', 'f.pdf', 'application/pdf', 10);
  insert into public.offers (id, space_id, slug, title, price_cents, currency) values (offer, a, 'o', 'O', 100, 'EUR');
  insert into public.offer_products (offer_id, product_id) values (offer, comm);
  insert into public.orders (space_id, offer_id, profile_id, email, provider, provider_order_id, amount_cents, currency,
                             livemode, waiver_version, waiver_accepted_at)
    values (a, offer, member, 'trash-member@test.local', 'fake', 'trash-1', 100, 'EUR', false, 'v1', now());
  insert into public.payment_credentials (space_id, env, client_id) values (a, 'sandbox', 'client');
  perform public.save_payment_secret(a, 'sandbox', 'shh');
end $$;

create temp table ids as select
  '29000000-0000-4000-8000-00000000000a'::uuid as a,
  '29000000-0000-4000-8000-00000000000b'::uuid as b,
  '29000000-0000-4000-8000-000000000c01'::uuid as comm,
  tests.get_supabase_uid('trash-member') as member,
  (select secret_id from public.payment_credentials where space_id = '29000000-0000-4000-8000-00000000000a') as secret;
grant select on ids to authenticated;

-- Privileges.
select ok(not has_table_privilege('authenticated', 'public.storage_trash', 'select'), 'members cannot read the queue');
select ok(not has_table_privilege('anon', 'public.storage_trash', 'insert'), 'anon cannot write the queue');
select ok(has_table_privilege('service_role', 'public.storage_trash', 'delete'), 'service role owns the queue');
select ok(not has_function_privilege('authenticated', 'public.storage_trash_take(integer)', 'execute'), 'members cannot take');
select ok(not has_function_privilege('authenticated', 'public.storage_queue_orphans(interval, integer)', 'execute'), 'members cannot sweep');
select ok(has_function_privilege('service_role', 'public.storage_trash_take(integer)', 'execute'), 'service role can take');
select ok(has_function_privilege('service_role', 'public.storage_trash_done(text, text[])', 'execute'), 'service role can mark done');
select hasnt_function('public', 'channel_files', array['uuid'], 'channel_files is gone');

-- Every *_path column is covered, except the unused parts.poster_path.
select is_empty($$
  select c.table_name::text, c.column_name::text from information_schema.columns c
  where c.table_schema = 'public' and c.column_name like '%path' and c.data_type = 'text'
    and (c.table_name, c.column_name) not in (select tbl, col from public.storage_columns())
    and (c.table_name, c.column_name) not in (('parts', 'poster_path'), ('storage_trash', 'path'))
    and c.table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
$$, 'every path column has a bucket');
select is((select count(*)::int from public.storage_columns() c
  where not exists (select 1 from pg_trigger t where t.tgrelid = ('public.' || c.tbl)::regclass and t.tgname = c.tbl || '_storage_trash')),
  0, 'every path table has the trigger');

-- Update queues the old path only when it changes.
update public.space_profiles set display_name = 'Renamed' from ids where space_id = ids.a and profile_id = ids.member;
select is((select count(*)::int from public.storage_trash), 0, 'unrelated update queues nothing');
update public.space_profiles set avatar_path = ids.a || '/avatars/' || member || '/m2.png' from ids where space_id = ids.a and profile_id = ids.member;
select results_eq($$ select bucket, path from public.storage_trash $$,
  $$ select 'site'::text, a || '/avatars/' || member || '/m.png' from ids $$, 'avatar replace queues the old avatar');
update public.space_branding set logo_path = null from ids where space_id = ids.a;
select ok(exists (select 1 from public.storage_trash, ids where path = ids.a || '/site/logo.png'), 'logo removal queues the logo');

-- Deleting a community queues its files and leaves no rows of it.
delete from public.products using ids where id = ids.comm;
select ok(exists (select 1 from public.storage_trash where bucket = 'community' and path like '%/p.png'), 'post photo queued');
select ok(exists (select 1 from public.storage_trash where bucket = 'community' and path like '%/f.pdf'), 'DM attachment queued');
select ok(exists (select 1 from public.storage_trash, ids where bucket = 'site' and path = ids.a || '/site/comm.png'), 'cover queued');
select is((select count(*)::int from public.channels c, ids where c.community_id = ids.comm)
        + (select count(*)::int from public.access_groups g, ids where g.community_id = ids.comm)
        + (select count(*)::int from public.dm_threads t, ids where t.community_id = ids.comm)
        + (select count(*)::int from public.grants g, ids where g.product_id = ids.comm), 0, 'no community rows left');

-- Erasing a member queues the avatar (no path list returned any more).
select is((select public.erase_member_space(b, member) from ids), '{"last_space": false}'::jsonb, 'erase returns only last_space');
select ok(exists (select 1 from public.storage_trash, ids where path = ids.b || '/avatars/' || member || '/m.png'), 'erased avatar queued');

-- Deleting a space reaches every path table and Vault.
delete from public.spaces using ids where id = ids.a;
select is((select count(*)::int from public.storage_trash where bucket = 'resources'), 3, 'part, episode and download file queued');
select is((select count(*)::int from public.storage_trash, ids where bucket = 'site' and path like ids.a || '/%'), 6,
  'both avatars, logo, favicon and cover queued');
select is((select count(*)::int from vault.secrets s, ids where s.id = ids.secret), 0, 'payment secret left Vault');
select is((select count(*)::int from public.products p, ids where p.space_id = ids.a)
        + (select count(*)::int from public.orders o, ids where o.space_id = ids.a)
        + (select count(*)::int from public.offers o, ids where o.space_id = ids.a)
        + (select count(*)::int from public.space_profiles s, ids where s.space_id = ids.a), 0, 'no space rows left');

-- Take skips (and drops) paths a row points at again; done removes paths.
insert into public.space_profiles (space_id, profile_id, display_name, avatar_path)
  select b, member, 'Back', b || '/avatars/' || member || '/m.png' from ids;
select ok(not exists (select 1 from public.storage_trash_take(1000) t, ids where t.path = ids.b || '/avatars/' || member || '/m.png'), 'path in use not taken');
select ok(not exists (select 1 from public.storage_trash, ids where path = ids.b || '/avatars/' || member || '/m.png'), 'path in use left the queue');
select is((select count(*)::int from public.storage_trash_take(2)), 2, 'take honours the limit');
select public.storage_trash_done('resources', array(select path from public.storage_trash where bucket = 'resources'));
select is((select count(*)::int from public.storage_trash where bucket = 'resources'), 0, 'done removes paths');

-- Orphan sweep: old and unreferenced only; site page JSON counts as a reference.
delete from public.storage_trash;
insert into public.pages (space_id, slug, title, draft)
  select b, 'home', 'Home', jsonb_build_array(jsonb_build_object('id', 'h', 'kind', 'hero', 'hidden', false,
    'fields', jsonb_build_object('image', b || '/site/hero.png'), 'items', '[]'::jsonb)) from ids;
insert into storage.objects (bucket_id, name, created_at) select v.bucket, v.name, v.at from ids, lateral (values
  ('resources', b || '/x/old.pdf', now() - interval '2 days'),
  ('resources', b || '/x/new.pdf', now() - interval '1 hour'),
  ('site', b || '/site/hero.png', now() - interval '2 days'),
  ('site', b || '/avatars/' || member || '/m.png', now() - interval '2 days')) as v(bucket, name, at);
select is(public.storage_queue_orphans(), 1, 'one orphan queued');
select results_eq($$ select bucket, path from public.storage_trash $$,
  $$ select 'resources'::text, b || '/x/old.pdf' from ids $$, 'only the old unreferenced upload');

select * from finish(true);
rollback;
