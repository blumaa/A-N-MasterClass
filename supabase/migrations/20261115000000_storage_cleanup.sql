-- Storage cleanup (Group 2). SQL cascades never reach Storage, so rows that hold a Storage path
-- queue the old path in storage_trash when they are deleted or their path changes. The app drains
-- the queue through the Storage API (src/lib/storage/trash.ts); SQL never deletes storage.objects.
-- An orphan sweep queues objects no row points at after a grace period (uploads never saved,
-- site images dropped from every page and page version).
-- One list of path columns (storage_columns) drives the triggers and the reference check.
-- Service role only.

create table public.storage_trash (
  bucket text not null constraint storage_trash_bucket check (bucket in ('resources', 'community', 'site')),
  path text not null constraint storage_trash_path check (length(path) > 0),
  queued_at timestamptz not null default now(),
  primary key (bucket, path)
);
create index storage_trash_queued on public.storage_trash (queued_at);
alter table public.storage_trash enable row level security;
revoke all on public.storage_trash from public, anon, authenticated;
grant select, insert, delete on public.storage_trash to service_role;

-- Every column holding a Storage object path, with its bucket. parts.poster_path is unused (no
-- bucket yet) and left out on purpose. Site page images live in pages/page_versions JSON (storage_refs).
create function public.storage_columns() returns table (tbl text, col text, bucket text)
language sql immutable set search_path = '' as $$
  values
    ('parts', 'file_path', 'resources'),
    ('product_files', 'file_path', 'resources'),
    ('episodes', 'audio_path', 'resources'),
    ('post_photos', 'path', 'community'),
    ('messages', 'attachment_path', 'community'),
    ('products', 'cover_path', 'site'),
    ('space_branding', 'logo_path', 'site'),
    ('space_branding', 'favicon_path', 'site'),
    ('space_profiles', 'avatar_path', 'site');
$$;

-- Trigger args: bucket, then the path columns. Queues the old path on delete, or on update when it changed.
create function public.queue_storage_trash() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_path text;
begin
  for i in 1 .. tg_nargs - 1 loop
    old_path := to_jsonb(old) ->> tg_argv[i];
    if old_path is not null and (tg_op = 'DELETE' or old_path is distinct from to_jsonb(new) ->> tg_argv[i]) then
      insert into public.storage_trash (bucket, path) values (tg_argv[0], old_path) on conflict do nothing;
    end if;
  end loop;
  return null;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select c.tbl, c.bucket, string_agg(quote_ident(c.col), ', ') as cols, string_agg(quote_literal(c.col), ', ') as args
    from public.storage_columns() c group by c.tbl, c.bucket
  loop
    execute format(
      'create trigger %I after delete or update of %s on public.%I for each row execute function public.queue_storage_trash(%L, %s)',
      t.tbl || '_storage_trash', t.cols, t.tbl, t.bucket, t.args);
  end loop;
end $$;

-- Every (bucket, path) a row still points at: the path columns plus string values in site pages.
create function public.storage_refs() returns table (bucket text, path text)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text;
begin
  select string_agg(format('select %L::text, %I::text from public.%I where %I is not null', c.bucket, c.col, c.tbl, c.col), ' union all ')
    into q from public.storage_columns() c;
  return query execute q;
  return query
    select 'site'::text, s #>> '{}'
    from public.pages p, jsonb_path_query(coalesce(p.draft, 'null') || coalesce(p.published, 'null'),
                                          'strict $.** ? (@.type() == "string")') s;
  return query
    select 'site'::text, s #>> '{}'
    from public.page_versions v, jsonb_path_query(v.sections, 'strict $.** ? (@.type() == "string")') s;
end;
$$;

-- Queues objects older than the grace period that no row points at. Returns how many were queued.
create function public.storage_queue_orphans(grace interval default '24 hours', max_rows integer default 1000) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  with refs as materialized (select * from public.storage_refs()),
  orphans as (
    select o.bucket_id, o.name from storage.objects o
    where o.bucket_id in ('resources', 'community', 'site')
      and o.created_at < now() - grace
      and o.name not like '%.emptyFolderPlaceholder'
      and not exists (select 1 from refs r where r.bucket = o.bucket_id and r.path = o.name)
    order by o.created_at
    limit max_rows
  )
  insert into public.storage_trash (bucket, path) select bucket_id, name from orphans on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Oldest queued paths to remove. Paths a row points at again leave the queue instead.
create function public.storage_trash_take(max_rows integer default 500) returns table (bucket text, path text)
language sql volatile security definer set search_path = '' as $$
  with refs as materialized (select * from public.storage_refs()),
  revived as (
    delete from public.storage_trash t using refs r where r.bucket = t.bucket and r.path = t.path returning t.bucket, t.path
  )
  select t.bucket, t.path from public.storage_trash t
  where not exists (select 1 from revived v where v.bucket = t.bucket and v.path = t.path)
  order by t.queued_at, t.path
  limit max_rows;
$$;

-- Drops paths whose objects are gone.
create function public.storage_trash_done(target_bucket text, paths text[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.storage_trash where bucket = target_bucket and path = any(paths);
$$;

revoke execute on function public.storage_columns() from public, anon, authenticated;
revoke execute on function public.queue_storage_trash() from public, anon, authenticated;
revoke execute on function public.storage_refs() from public, anon, authenticated;
revoke execute on function public.storage_queue_orphans(interval, integer) from public, anon, authenticated;
revoke execute on function public.storage_trash_take(integer) from public, anon, authenticated;
revoke execute on function public.storage_trash_done(text, text[]) from public, anon, authenticated;
grant execute on function public.storage_queue_orphans(interval, integer) to service_role;
grant execute on function public.storage_trash_take(integer) to service_role;
grant execute on function public.storage_trash_done(text, text[]) to service_role;

-- Payment secrets leave Vault with their row (space delete cascades here), like calendar tokens.
create function public.payment_credentials_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.secret_id is not null then
    delete from vault.secrets where id = old.secret_id;
  end if;
  return old;
end;
$$;
create trigger payment_credentials_cleanup after delete on public.payment_credentials
  for each row execute function public.payment_credentials_cleanup();
revoke execute on function public.payment_credentials_cleanup() from public, anon, authenticated;

-- The triggers queue every path, so callers no longer need path lists.
drop function public.channel_files(uuid);

-- Same erase as 20261113000000_member_data.sql, minus the path lists (the triggers queue them).
create or replace function public.erase_member_space(target_space uuid, target_profile uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
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

  return jsonb_build_object('last_space', not remaining);
end;
$$;
