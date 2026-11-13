-- G25 export drift fix: member_space_data now covers every person-linked table, including
-- moderation_log (member as actor), post_approval_members, push_mutes and the rest listed in
-- memberDataCoverage.test.ts. Erase is unchanged. Grants carry over (same signature).

-- Everything this member wrote or owns in this space, as one JSON document. Same body as
-- 20261113000000_member_data.sql plus every person-linked table added since (see
-- src/lib/supabase/memberDataCoverage.test.ts). Secrets (feed token, push keys, claim hash) stay out.
create or replace function public.member_space_data(target_space uuid, target_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with sp as (select public.space_product_ids(target_space) as id),
  steps as (
    select s.id from public.steps s join public.modules m on m.id = s.module_id where m.program_id in (select id from sp)
  ),
  parts as (select p.id from public.parts p where p.step_id in (select id from steps)),
  channels as (select c.id from public.channels c where c.community_id in (select id from sp))
  select jsonb_build_object(
    'account', (select jsonb_build_object('email', p.email) from public.profiles p where p.id = target_profile),
    'profile', (select to_jsonb(r) - 'space_id' - 'profile_id' from public.space_profiles r
                where r.space_id = target_space and r.profile_id = target_profile),
    'role', (select r.role from public.space_members r where r.space_id = target_space and r.profile_id = target_profile),
    'access', coalesce((select jsonb_agg(jsonb_build_object('product', pr.title, 'source', g.source, 'status', g.status,
                         'granted_at', g.granted_at, 'expires_at', g.expires_at) order by g.granted_at)
                       from public.grants g join public.products pr on pr.id = g.product_id
                       where g.profile_id = target_profile and g.product_id in (select id from sp)), '[]'),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'email', o.email, 'amount_cents', o.amount_cents,
                         'currency', o.currency, 'status', o.status, 'created_at', o.created_at) order by o.created_at)
                       from public.orders o where o.space_id = target_space and o.profile_id = target_profile), '[]'),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s) - 'profile_id' - 'space_id' order by s.created_at)
                       from public.subscriptions s where s.space_id = target_space and s.profile_id = target_profile), '[]'),
    'contact', (select to_jsonb(c) - 'space_id' - 'profile_id' from public.contacts c
                where c.space_id = target_space and c.profile_id = target_profile),
    'progress', coalesce((select jsonb_agg(jsonb_build_object('step_id', x.step_id, 'completed_at', x.completed_at) order by x.completed_at)
                       from public.step_progress x where x.profile_id = target_profile and x.step_id in (select id from steps)), '[]'),
    'video_positions', coalesce((select jsonb_agg(jsonb_build_object('part_id', v.part_id, 'seconds', v.last_position_s, 'updated_at', v.updated_at))
                       from public.video_position v where v.profile_id = target_profile and v.part_id in (select id from parts)), '[]'),
    'quiz_attempts', coalesce((select jsonb_agg(to_jsonb(q) - 'profile_id' order by q.created_at)
                       from public.quiz_attempts q where q.profile_id = target_profile and q.part_id in (select id from parts)), '[]'),
    'certificates', coalesce((select jsonb_agg(to_jsonb(c) - 'profile_id' order by c.issued_at)
                       from public.certificates c where c.profile_id = target_profile and c.program_id in (select id from sp)), '[]'),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'created_at', p.created_at) order by p.created_at)
                       from public.posts p where p.author_id = target_profile and p.channel_id in (select id from channels)), '[]'),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'on', c.target_type, 'body', c.body, 'created_at', c.created_at) order by c.created_at)
                       from public.comments c where c.space_id = target_space and c.author_id = target_profile), '[]'),
    'reactions', coalesce((select jsonb_agg(jsonb_build_object('on', r.target_type, 'target_id', r.target_id, 'emoji', r.emoji, 'created_at', r.created_at) order by r.created_at)
                       from public.reactions r where r.profile_id = target_profile and (
                         (r.target_type = 'post' and r.target_id in (select p.id from public.posts p where p.channel_id in (select id from channels)))
                         or (r.target_type = 'comment' and r.target_id in (select c.id from public.comments c where c.space_id = target_space)))), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'attachment', m.attachment_name, 'created_at', m.created_at) order by m.created_at)
                       from public.messages m where m.author_id = target_profile and (
                         m.channel_id in (select id from channels)
                         or m.thread_id in (select t.id from public.dm_threads t where t.community_id in (select id from sp)))), '[]'),
    'challenge_entries', coalesce((select jsonb_agg(jsonb_build_object('challenge', ch.title, 'body', e.body, 'created_at', e.created_at) order by e.created_at)
                       from public.challenge_entries e join public.challenges ch on ch.id = e.challenge_id
                       where e.profile_id = target_profile and ch.community_id in (select id from sp)), '[]'),
    'meetup_rsvps', coalesce((select jsonb_agg(jsonb_build_object('meetup', mt.title, 'occurrence', r.occurrence, 'created_at', r.created_at) order by r.created_at)
                       from public.meetup_rsvps r join public.meetups mt on mt.id = r.meetup_id
                       where r.profile_id = target_profile and mt.community_id in (select id from sp)), '[]'),
    'points', coalesce((select jsonb_agg(jsonb_build_object('reason', l.reason, 'points', l.points, 'created_at', l.created_at) order by l.created_at)
                       from public.points_ledger l where l.profile_id = target_profile and l.community_id in (select id from sp)), '[]'),
    'coaching_sessions', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                         'status', s.status, 'agenda', s.agenda) order by s.starts_at)
                       from public.coaching_sessions s where s.space_id = target_space and s.client_id = target_profile), '[]'),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) - 'recipient_id' - 'space_id' order by n.created_at)
                       from public.notifications n where n.space_id = target_space and n.recipient_id = target_profile), '[]'),
    'notifications_sent', coalesce((select jsonb_agg(jsonb_build_object('type', n.type, 'post_id', n.post_id, 'step_id', n.step_id, 'created_at', n.created_at) order by n.created_at, n.id)
                       from public.notifications n where n.space_id = target_space and n.actor_id = target_profile), '[]'),
    'moderation_log', coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'target_type', l.target_type, 'target_id', l.target_id, 'created_at', l.created_at) order by l.created_at, l.id)
                       from public.moderation_log l where l.actor_id = target_profile and l.community_id in (select id from sp)), '[]'),
    'post_approval_members', coalesce((select jsonb_agg(jsonb_build_object('community', pr.title) order by pr.title)
                       from public.post_approval_members a join public.products pr on pr.id = a.community_id
                       where a.profile_id = target_profile and a.community_id in (select id from sp)), '[]'),
    'push_mutes', coalesce((select jsonb_agg(jsonb_build_object('type', m.type) order by m.type)
                       from public.push_mutes m where m.space_id = target_space and m.profile_id = target_profile), '[]'),
    'push_subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'user_agent', s.user_agent) order by s.created_at, s.id)
                       from public.push_subscriptions s where s.space_id = target_space and s.profile_id = target_profile), '[]'),
    'claim_tokens', coalesce((select jsonb_agg(jsonb_build_object('expires_at', t.expires_at, 'used_at', t.used_at) order by t.expires_at)
                       from public.claim_tokens t where t.space_id = target_space and t.profile_id = target_profile), '[]'),
    'channel_members', coalesce((select jsonb_agg(jsonb_build_object('channel', c.title) order by c.title)
                       from public.channel_members cm join public.channels c on c.id = cm.channel_id
                       where cm.profile_id = target_profile and cm.channel_id in (select id from channels)), '[]'),
    'channel_moderators', coalesce((select jsonb_agg(jsonb_build_object('channel', c.title) order by c.title)
                       from public.channel_moderators cm join public.channels c on c.id = cm.channel_id
                       where cm.profile_id = target_profile and cm.channel_id in (select id from channels)), '[]'),
    'community_staff', coalesce((select jsonb_agg(jsonb_build_object('community', pr.title) order by pr.title)
                       from public.space_member_communities s join public.products pr on pr.id = s.community_id
                       where s.profile_id = target_profile and s.community_id in (select id from sp)), '[]'),
    'dm_threads', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'community', pr.title) order by t.created_at, t.id)
                       from public.dm_threads t join public.products pr on pr.id = t.community_id
                       where t.community_id in (select id from sp) and target_profile in (t.a_id, t.b_id)), '[]'),
    'dm_reads', coalesce((select jsonb_agg(jsonb_build_object('thread_id', r.thread_id, 'read_at', r.read_at) order by r.read_at, r.thread_id)
                       from public.dm_reads r join public.dm_threads t on t.id = r.thread_id
                       where r.profile_id = target_profile and t.community_id in (select id from sp)), '[]'),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('community', pr.title, 'blocked', sp2.display_name) order by pr.title, sp2.display_name)
                       from public.blocks b join public.products pr on pr.id = b.community_id
                       left join public.space_profiles sp2 on sp2.space_id = target_space and sp2.profile_id = b.blocked_id
                       where b.blocker_id = target_profile and b.community_id in (select id from sp)), '[]'),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason,
                         'status', r.status, 'created_at', r.created_at) order by r.created_at, r.id)
                       from public.reports r where r.reporter_id = target_profile and r.community_id in (select id from sp)), '[]'),
    'podcast_feeds', coalesce((select jsonb_agg(jsonb_build_object('podcast', pr.title, 'created_at', f.created_at) order by f.created_at)
                       from public.podcast_feeds f join public.products pr on pr.id = f.product_id
                       where f.profile_id = target_profile and f.product_id in (select id from sp)), '[]')
  );
$$;
