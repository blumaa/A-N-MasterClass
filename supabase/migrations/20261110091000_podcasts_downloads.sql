-- Launch 5: podcast + download products (G18).
-- Additive. Mirrors src/lib/data/types.ts (Podcasts / Downloads sections), src/lib/data/fake/fakeMediaRepo.ts
-- and src/features/{podcasts,downloads}/api.
-- Kajabi: https://help.kajabi.com/en/articles/17174383-kajabi-products-overview
-- - podcast = settings + episodes (mp3, up to 250 MB); buyers get a private feed URL per person;
-- - resetting the feed replaces the token, the old URL stops working;
-- - the feed works only while the listener's grant is active;
-- - download = list of files; holders fetch them through short signed URLs;
-- - files live in the private `resources` bucket; only the server (service role) signs URLs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.podcast_settings (
  product_id uuid primary key references public.products (id) on delete cascade,
  author text not null default '' constraint podcast_settings_author check (length(author) <= 200),
  explicit boolean not null default false,
  episode_order text not null default 'episodic'
    constraint podcast_settings_order check (episode_order in ('episodic', 'serial'))
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text not null constraint episodes_title check (length(trim(title)) > 0),
  type text not null default 'full' constraint episodes_type check (type in ('full', 'bonus', 'trailer')),
  season integer constraint episodes_season check (season is null or season >= 1),
  show_notes text not null default '' constraint episodes_show_notes check (length(show_notes) <= 20000),
  audio_path text not null constraint episodes_audio_path check (audio_path ~* '\.mp3$'),
  audio_bytes bigint not null constraint episodes_audio_bytes check (audio_bytes between 1 and 262144000),
  duration_s integer constraint episodes_duration check (duration_s is null or duration_s >= 0),
  explicit boolean not null default false,
  -- null = draft; future = scheduled.
  publish_at timestamptz,
  created_at timestamptz not null default now()
);
create index episodes_product on public.episodes (product_id, publish_at);

-- One private feed token per listener and podcast.
create table public.podcast_feeds (
  product_id uuid not null references public.products (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null constraint podcast_feeds_token unique,
  created_at timestamptz not null default now(),
  primary key (product_id, profile_id)
);

create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text not null constraint product_files_title check (length(trim(title)) > 0),
  file_path text not null constraint product_files_path check (length(trim(file_path)) > 0),
  size_bytes bigint not null constraint product_files_size check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index product_files_product on public.product_files (product_id, created_at);

-- ---------------------------------------------------------------------------
-- Shape guards: rows only on products of the matching kind
-- ---------------------------------------------------------------------------

create function public.media_product_matches() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := tg_argv[0];
begin
  if (select p.kind from public.products p where p.id = new.product_id) is distinct from wanted then
    raise exception '% needs a % product', tg_table_name, wanted using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger podcast_settings_kind before insert or update of product_id on public.podcast_settings
  for each row execute function public.media_product_matches('podcast');
create trigger episodes_kind before insert or update of product_id on public.episodes
  for each row execute function public.media_product_matches('podcast');
create trigger podcast_feeds_kind before insert or update of product_id on public.podcast_feeds
  for each row execute function public.media_product_matches('podcast');
create trigger product_files_kind before insert or update of product_id on public.product_files
  for each row execute function public.media_product_matches('download');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.podcast_settings enable row level security;
alter table public.episodes enable row level security;
alter table public.podcast_feeds enable row level security;
alter table public.product_files enable row level security;

-- Settings: readable with the product, written by products.edit.
create policy podcast_settings_read on public.podcast_settings for select
  using (exists (select 1 from public.products p where p.id = product_id));
create policy podcast_settings_write on public.podcast_settings for all
  using (public.has_capability(public.product_space(product_id), 'products.edit'))
  with check (public.has_capability(public.product_space(product_id), 'products.edit'));

-- Episodes: staff all; holders the published ones (publish_at reached).
create policy episodes_read on public.episodes for select
  using (
    public.has_capability(public.product_space(product_id), 'products.edit')
    or (public.has_grant(product_id) and publish_at is not null and publish_at <= now())
  );
create policy episodes_write on public.episodes for all
  using (public.has_capability(public.product_space(product_id), 'products.edit'))
  with check (public.has_capability(public.product_space(product_id), 'products.edit'));

-- Feeds: listeners read their own row; tokens are made through the RPCs below.
create policy podcast_feeds_read on public.podcast_feeds for select
  using (profile_id = auth.uid());

-- Files: staff all; holders read.
create policy product_files_read on public.product_files for select
  using (
    public.has_capability(public.product_space(product_id), 'products.edit')
    or public.has_grant(product_id)
  );
create policy product_files_write on public.product_files for all
  using (public.has_capability(public.product_space(product_id), 'products.edit'))
  with check (public.has_capability(public.product_space(product_id), 'products.edit'));

-- ---------------------------------------------------------------------------
-- Feed RPCs
-- ---------------------------------------------------------------------------

-- The caller's feed token, created on first ask (repo.podcastFeedToken).
create function public.podcast_feed_token(target_product uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text;
begin
  if not public.has_grant(target_product) then
    raise exception 'an active grant is required' using errcode = '23514';
  end if;
  insert into public.podcast_feeds (product_id, profile_id, token)
  values (target_product, auth.uid(), gen_random_uuid()::text)
  on conflict (product_id, profile_id) do nothing;
  select f.token into t from public.podcast_feeds f
  where f.product_id = target_product and f.profile_id = auth.uid();
  return t;
end;
$$;

-- New token; the old feed URL stops working (repo.resetPodcastFeed).
create function public.reset_podcast_feed(target_product uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text := gen_random_uuid()::text;
begin
  if not public.has_grant(target_product) then
    raise exception 'an active grant is required' using errcode = '23514';
  end if;
  insert into public.podcast_feeds (product_id, profile_id, token)
  values (target_product, auth.uid(), t)
  on conflict (product_id, profile_id) do update set token = excluded.token, created_at = now();
  return t;
end;
$$;

-- Service role only (repo.podcastFeedByToken): the feed behind a token while its grant is active.
create function public.podcast_feed(target_token text) returns setof public.podcast_feeds
language sql stable security definer set search_path = '' as $$
  select f.* from public.podcast_feeds f
  where f.token = target_token and exists (
    select 1 from public.grants g
    where g.product_id = f.product_id and g.profile_id = f.profile_id and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
  );
$$;

revoke execute on function public.podcast_feed_token(uuid) from public, anon;
revoke execute on function public.reset_podcast_feed(uuid) from public, anon;
grant execute on function public.podcast_feed_token(uuid) to authenticated;
grant execute on function public.reset_podcast_feed(uuid) to authenticated;
revoke execute on function public.podcast_feed(text) from public, anon, authenticated;
grant execute on function public.podcast_feed(text) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, no object policies = service role only (signed URLs from the server)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 262144000)
on conflict (id) do nothing;
