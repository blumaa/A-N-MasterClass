-- Member data export and per-space erase (G25). Service role only: the DAL checks the viewer and
-- passes its own profile id. Space of a row comes from its product (program, community, coaching,
-- podcast) when the table has no space_id.

-- Product ids of one space.
create function public.space_product_ids(target_space uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.products where space_id = target_space;
$$;

-- Everything this member wrote or owns in this space, as one JSON document.
create function public.member_space_data(target_space uuid, target_profile uuid) returns jsonb
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
                       from public.notifications n where n.space_id = target_space and n.recipient_id = target_profile), '[]')
  );
$$;

-- Erases this member from one space. Orders and subscriptions stay for the seller's records
-- (legal retention) without the profile link, like a global delete (on delete set null).
-- Returns the Storage paths that lost their rows and whether the member still belongs anywhere.
create function public.erase_member_space(target_space uuid, target_profile uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  site_paths text[];
  community_paths text[];
  remaining boolean;
  products uuid[];
  chans uuid[];
  threads uuid[];
begin
  if exists (select 1 from public.space_members where space_id = target_space and profile_id = target_profile and role = 'owner') then
    raise exception 'owner cannot leave the space' using errcode = 'P0001';
  end if;

  products := array(select public.space_product_ids(target_space));
  chans := array(select c.id from public.channels c where c.community_id = any(products));
  threads := array(select t.id from public.dm_threads t
                   where t.community_id = any(products) and target_profile in (t.a_id, t.b_id));

  site_paths := array(select avatar_path from public.space_profiles
                      where space_id = target_space and profile_id = target_profile and avatar_path is not null);
  community_paths := array(
    select ph.path from public.post_photos ph join public.posts p on p.id = ph.post_id
    where p.author_id = target_profile and p.channel_id = any(chans)
    union all
    select m.attachment_path from public.messages m
    where m.attachment_path is not null and (
      (m.author_id = target_profile and m.channel_id = any(chans))
      or m.thread_id = any(threads))
  );

  delete from public.posts where author_id = target_profile and channel_id = any(chans);
  delete from public.comments where space_id = target_space and author_id = target_profile;
  delete from public.reactions r where r.profile_id = target_profile and (
    (r.target_type = 'post' and r.target_id in (select p.id from public.posts p where p.channel_id = any(chans)))
    or (r.target_type = 'comment' and r.target_id in (select c.id from public.comments c where c.space_id = target_space)));
  delete from public.messages where author_id = target_profile and channel_id = any(chans);
  delete from public.dm_threads where id = any(threads);
  delete from public.channel_members where profile_id = target_profile and channel_id = any(chans);
  delete from public.channel_moderators where profile_id = target_profile and channel_id = any(chans);
  delete from public.blocks where community_id = any(products) and target_profile in (blocker_id, blocked_id);
  delete from public.reports where reporter_id = target_profile and community_id = any(products);
  delete from public.points_ledger where profile_id = target_profile and community_id = any(products);
  delete from public.challenge_entries e using public.challenges ch
    where ch.id = e.challenge_id and e.profile_id = target_profile and ch.community_id = any(products);
  delete from public.meetup_rsvps r using public.meetups mt
    where mt.id = r.meetup_id and r.profile_id = target_profile and mt.community_id = any(products);
  delete from public.space_member_communities where profile_id = target_profile and community_id = any(products);
  delete from public.step_progress x using public.steps s, public.modules m
    where s.id = x.step_id and m.id = s.module_id and x.profile_id = target_profile and m.program_id = any(products);
  delete from public.video_position v using public.parts p, public.steps s, public.modules m
    where p.id = v.part_id and s.id = p.step_id and m.id = s.module_id
      and v.profile_id = target_profile and m.program_id = any(products);
  delete from public.quiz_attempts q using public.parts p, public.steps s, public.modules m
    where p.id = q.part_id and s.id = p.step_id and m.id = s.module_id
      and q.profile_id = target_profile and m.program_id = any(products);
  delete from public.certificates where profile_id = target_profile and program_id = any(products);
  delete from public.podcast_feeds where profile_id = target_profile and product_id = any(products);
  delete from public.coaching_sessions where space_id = target_space and client_id = target_profile;
  delete from public.grants where profile_id = target_profile and product_id = any(products);
  delete from public.notifications where space_id = target_space and target_profile in (recipient_id, actor_id);
  delete from public.push_subscriptions where space_id = target_space and profile_id = target_profile;
  delete from public.claim_tokens where space_id = target_space and profile_id = target_profile;
  delete from public.contacts where space_id = target_space and profile_id = target_profile;
  update public.orders set profile_id = null where space_id = target_space and profile_id = target_profile;
  update public.subscriptions set profile_id = null where space_id = target_space and profile_id = target_profile;
  delete from public.space_members where space_id = target_space and profile_id = target_profile;
  delete from public.space_profiles where space_id = target_space and profile_id = target_profile;

  remaining := exists (select 1 from public.space_profiles where profile_id = target_profile)
    or exists (select 1 from public.space_members where profile_id = target_profile)
    or exists (select 1 from public.grants where profile_id = target_profile);

  return jsonb_build_object('site', to_jsonb(site_paths), 'community', to_jsonb(community_paths), 'last_space', not remaining);
end;
$$;

revoke execute on function public.space_product_ids(uuid) from public, anon, authenticated;
revoke execute on function public.member_space_data(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.erase_member_space(uuid, uuid) from public, anon, authenticated;
grant execute on function public.space_product_ids(uuid) to service_role;
grant execute on function public.member_space_data(uuid, uuid) to service_role;
grant execute on function public.erase_member_space(uuid, uuid) to service_role;
