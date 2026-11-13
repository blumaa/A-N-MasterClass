-- G25: the member export covers the person-linked tables added after the first version
-- (moderation log, approval list, push mutes, memberships, blocks, reports, feeds, devices).
-- Only the member's own rows, only the target space.
begin;
select plan(24);

do $$
declare
  a uuid := '34000000-0000-4000-8000-00000000000a';
  b uuid := '34000000-0000-4000-8000-00000000000b';
  comm uuid := '34000000-0000-4000-8000-000000000c01';
  comm_b uuid := '34000000-0000-4000-8000-000000000c02';
  pod uuid := '34000000-0000-4000-8000-000000000a01';
  feed uuid := '34000000-0000-4000-8000-000000000f01';
  feed_b uuid := '34000000-0000-4000-8000-000000000f02';
  post uuid := '34000000-0000-4000-8000-000000000e01';
  post_b uuid := '34000000-0000-4000-8000-000000000e02';
  thread uuid := '34000000-0000-4000-8000-000000000101';
  member uuid;
  friend uuid;
begin
  perform tests.create_supabase_user('cov-member');
  perform tests.create_supabase_user('cov-friend');
  member := tests.get_supabase_uid('cov-member');
  friend := tests.get_supabase_uid('cov-friend');
  insert into public.spaces (id, slug, name, status) values (a, 'cov-a', 'A', 'live'), (b, 'cov-b', 'B', 'live');
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (a, member, 'Member'), (a, friend, 'Friend'), (b, member, 'Member B');
  insert into public.products (id, space_id, kind, slug, title, status) values
    (comm, a, 'community', 'community', 'Community A', 'published'),
    (pod, a, 'podcast', 'pod', 'Podcast A', 'published'),
    (comm_b, b, 'community', 'community', 'Community B', 'published');
  insert into public.channels (id, community_id, title) values (feed, comm, 'General'), (feed_b, comm_b, 'General B');
  insert into public.posts (id, channel_id, author_id, body) values (post, feed, friend, 'theirs'), (post_b, feed_b, friend, 'theirs b');

  -- moderation log: member is the actor in A and B, friend acts in A
  insert into public.moderation_log (actor_id, action, target_type, target_id) values
    (member, 'hide', 'post', post), (member, 'hide', 'post', post_b), (friend, 'lock', 'post', post);
  insert into public.post_approval_members (community_id, profile_id) values (comm, member), (comm, friend), (comm_b, member);
  insert into public.push_mutes (space_id, profile_id, type) values (a, member, 'reaction'), (b, member, 'comment'), (a, friend, 'mention');

  insert into public.channel_members (channel_id, profile_id) values (feed, member), (feed, friend);
  insert into public.channel_moderators (channel_id, profile_id) values (feed, member);
  insert into public.space_member_communities (community_id, profile_id) values (comm, member), (comm_b, member);
  insert into public.dm_threads (id, community_id, a_id, b_id) values (thread, comm, least(member, friend), greatest(member, friend));
  insert into public.dm_reads (thread_id, profile_id) values (thread, member), (thread, friend);
  insert into public.blocks (community_id, blocker_id, blocked_id) values (comm, member, friend), (comm, friend, member);
  insert into public.reports (target_type, target_id, reporter_id, reason) values ('post', post, member, 'spam'), ('post', post, friend, 'other');
  insert into public.podcast_feeds (product_id, profile_id, token) values (pod, member, 'cov-secret-token');
  insert into public.push_subscriptions (space_id, profile_id, endpoint, p256dh, auth, user_agent)
    values (a, member, 'https://push.example/cov', 'key', 'secret-auth', 'UA');
  insert into public.claim_tokens (token_hash, space_id, profile_id, expires_at)
    values (repeat('a', 64), a, member, now() + interval '1 day');
  insert into public.notifications (space_id, recipient_id, actor_id, type, post_id) values (a, friend, member, 'reaction', post);
end $$;

create temp table export as select public.member_space_data(
  '34000000-0000-4000-8000-00000000000a'::uuid, tests.get_supabase_uid('cov-member')) as d;

select is((select jsonb_array_length(d->'moderation_log') from export), 1, 'log: only own actions in this space');
select is((select d->'moderation_log'->0->>'action' from export), 'hide', 'log: action exported');
select is((select d->'moderation_log'->0->>'target_type' from export), 'post', 'log: target type exported');

select is((select d->'post_approval_members' from export), '[{"community": "Community A"}]'::jsonb, 'approval: own row of this space');
select is((select d->'push_mutes' from export), '[{"type": "reaction"}]'::jsonb, 'mutes: own type of this space');

select is((select d->'channel_members' from export), '[{"channel": "General"}]'::jsonb, 'channel membership: own row');
select is((select d->'channel_moderators' from export), '[{"channel": "General"}]'::jsonb, 'channel moderator: own row');
select is((select d->'community_staff' from export), '[{"community": "Community A"}]'::jsonb, 'community staff: this space only');
select is((select jsonb_array_length(d->'dm_threads') from export), 1, 'dm thread of the member');
select is((select jsonb_array_length(d->'dm_reads') from export), 1, 'dm read marker: own row');
select is((select d->'blocks' from export), '[{"community": "Community A", "blocked": "Friend"}]'::jsonb, 'blocks: made by the member');
select is((select jsonb_array_length(d->'reports') from export), 1, 'reports: own only');
select is((select d->'reports'->0->>'reason' from export), 'spam', 'report reason exported');
select is((select jsonb_array_length(d->'podcast_feeds') from export), 1, 'podcast feed listed');
select is((select d->'podcast_feeds'->0->>'podcast' from export), 'Podcast A', 'podcast feed names the show');
select is((select jsonb_array_length(d->'push_subscriptions') from export), 1, 'push device listed');
select is((select jsonb_array_length(d->'claim_tokens') from export), 1, 'claim link listed');
select is((select jsonb_array_length(d->'notifications_sent') from export), 1, 'notifications caused by the member');

-- Secrets stay out.
select ok(position('cov-secret-token' in d::text) = 0, 'feed token not exported') from export;
select ok(position('secret-auth' in d::text) = 0, 'push keys not exported') from export;
select ok(position(repeat('a', 64) in d::text) = 0, 'claim token hash not exported') from export;

-- Other space and other members never leak.
select ok(position('Community B' in d::text) = 0 and position('General B' in d::text) = 0, 'nothing from space B') from export;
select is((select count(*)::int from jsonb_array_elements((select d from export)->'moderation_log') e where e->>'target_id' = '34000000-0000-4000-8000-000000000e02'), 0, 'log: no entry from space B');
select is((select (public.member_space_data('34000000-0000-4000-8000-00000000000b', tests.get_supabase_uid('cov-member')))->'push_mutes'),
  '[{"type": "comment"}]'::jsonb, 'space B export has its own mute only');

select * from finish(true);
rollback;
