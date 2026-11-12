-- G25: member data export and per-space erase. Rows of the space go, the other space stays,
-- orders keep their record without the member, owners cannot leave.
begin;
select plan(15);

do $$
declare
  a uuid := '27000000-0000-4000-8000-00000000000a';
  b uuid := '27000000-0000-4000-8000-00000000000b';
  comm uuid := '27000000-0000-4000-8000-000000000c01';
  comm_b uuid := '27000000-0000-4000-8000-000000000c02';
  prog uuid := '27000000-0000-4000-8000-000000000a01';
  modl uuid := '27000000-0000-4000-8000-000000000b01';
  stp uuid := '27000000-0000-4000-8000-000000000d01';
  feed uuid := '27000000-0000-4000-8000-000000000e01';
  feed_b uuid := '27000000-0000-4000-8000-000000000e02';
  post uuid := '27000000-0000-4000-8000-000000000f01';
  other_post uuid := '27000000-0000-4000-8000-000000000f02';
  thread uuid := '27000000-0000-4000-8000-000000000101';
  offer uuid := '27000000-0000-4000-8000-000000000201';
  member uuid;
  friend uuid;
begin
  perform tests.create_supabase_user('erase-owner');
  perform tests.create_supabase_user('erase-member');
  perform tests.create_supabase_user('erase-friend');
  member := tests.get_supabase_uid('erase-member');
  friend := tests.get_supabase_uid('erase-friend');
  insert into public.spaces (id, slug, name, status) values (a, 'erase-a', 'A', 'live'), (b, 'erase-b', 'B', 'live');
  insert into public.space_members values (a, tests.get_supabase_uid('erase-owner'), 'owner', now());
  insert into public.space_profiles (space_id, profile_id, display_name, avatar_path) values
    (a, member, 'Member', a || '/avatars/' || member || '/me.png'),
    (a, friend, 'Friend', null),
    (b, member, 'Member B', null);
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, a, 'community', 'community', 'Community', 'published'),
    (prog, a, 'program', 'rope-1', 'Rope 1', 'published'),
    (comm_b, b, 'community', 'community', 'Community B', 'published');
  insert into public.modules (id, program_id, title, status) values (modl, prog, 'M', 'published');
  insert into public.steps (id, module_id, title, status) values (stp, modl, 'Intro', 'published');
  insert into public.grants (product_id, profile_id, source) values
    (comm, member, 'manual'), (prog, member, 'manual'), (comm, friend, 'manual'), (comm_b, member, 'manual');
  insert into public.step_progress (profile_id, step_id) values (member, stp);
  insert into public.channels (id, community_id, title) values (feed, comm, 'General'), (feed_b, comm_b, 'General');
  insert into public.posts (id, channel_id, author_id, body) values
    (post, feed, member, 'mine'), (other_post, feed, friend, 'theirs'),
    ('27000000-0000-4000-8000-000000000f03', feed_b, member, 'in b');
  insert into public.post_photos (post_id, path) values (post, public.channel_folder(feed) || 'p.png');
  insert into public.comments (space_id, target_type, target_id, author_id, body) values
    (a, 'post', other_post, member, 'nice');
  insert into public.reactions (target_type, target_id, profile_id, emoji) values ('post', other_post, member, '👍');
  insert into public.dm_threads (id, community_id, a_id, b_id) values (thread, comm, least(member, friend), greatest(member, friend));
  insert into public.messages (thread_id, author_id, body, attachment_path, attachment_name, attachment_type, attachment_size)
    values (thread, friend, 'file', public.thread_folder(thread) || 'f.pdf', 'f.pdf', 'application/pdf', 10);
  insert into public.offers (id, space_id, slug, title, price_cents, currency) values (offer, a, 'o', 'O', 100, 'EUR');
  insert into public.orders (space_id, offer_id, profile_id, email, provider, provider_order_id, amount_cents, currency,
                             livemode, waiver_version, waiver_accepted_at)
    values (a, offer, member, 'erase-member@test.local', 'fake', 'erase-1', 100, 'EUR', false, 'v1', now());
end $$;

create temp table ids as select
  tests.get_supabase_uid('erase-member') as member,
  tests.get_supabase_uid('erase-owner') as owner,
  '27000000-0000-4000-8000-00000000000a'::uuid as a,
  '27000000-0000-4000-8000-00000000000b'::uuid as b;

-- Only the service role may call the functions.
select ok(not has_function_privilege('authenticated', 'public.member_space_data(uuid, uuid)', 'execute'), 'members cannot export directly');
select ok(not has_function_privilege('authenticated', 'public.erase_member_space(uuid, uuid)', 'execute'), 'members cannot erase directly');
select ok(has_function_privilege('service_role', 'public.erase_member_space(uuid, uuid)', 'execute'), 'service role can erase');

-- Export covers this space only.
create temp table export as select public.member_space_data(a, member) as d from ids;
select is((select d->'profile'->>'display_name' from export), 'Member', 'export has the space profile');
select is((select jsonb_array_length(d->'posts') from export), 1, 'export has posts of this space only');
select is((select jsonb_array_length(d->'access') from export), 2, 'export has grants of this space only');
select is((select jsonb_array_length(d->'orders') from export), 1, 'export has orders');

select throws_ok($$ select public.erase_member_space(a, owner) from ids $$, 'P0001', 'owner cannot leave the space',
  'owner cannot erase themselves');

create temp table erased as select public.erase_member_space(a, member) as r from ids;
select is((select (r->>'last_space')::boolean from erased), false, 'member still belongs to space B');

select is((select count(*)::int from public.space_profiles sp, ids where sp.space_id = ids.a and sp.profile_id = ids.member), 0, 'profile in A gone');
select is((select count(*)::int from public.posts p, ids where p.author_id = ids.member), 1, 'only the post in B remains');
select is((select count(*)::int from public.grants g, ids where g.profile_id = ids.member), 1, 'only the grant in B remains');
select is((select count(*)::int from public.dm_threads where id = '27000000-0000-4000-8000-000000000101'), 0, 'DM thread in A gone');
select is((select count(*)::int from public.orders o, ids where o.space_id = ids.a and o.profile_id is null), 1, 'order kept without the member');

select is((select (public.erase_member_space(b, member)->>'last_space')::boolean from ids), true, 'last space left');

select * from finish(true);
rollback;
