-- Launch 6 item 6: web push. One row per browser subscription, owned by a profile on one space.
-- A push for space A goes only to rows of space A (each space host has its own service worker,
-- so its own endpoint). The app sends with the secret key; members only manage their own rows.
-- Docs: https://nextjs.org/docs/app/guides/progressive-web-apps

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null
    constraint push_subscriptions_endpoint_key unique
    constraint push_subscriptions_endpoint_https check (endpoint ~ '^https://' and length(endpoint) <= 2000),
  p256dh text not null constraint push_subscriptions_p256dh check (length(p256dh) between 1 and 200),
  auth text not null constraint push_subscriptions_auth check (length(auth) between 1 and 200),
  user_agent text constraint push_subscriptions_user_agent check (length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

create index push_subscriptions_target on public.push_subscriptions (space_id, profile_id);

alter table public.push_subscriptions enable row level security;

-- Own rows only. Writes go through save_push_subscription (insert) and plain delete.
create policy push_subscriptions_read on public.push_subscriptions for select
  using (profile_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete
  using (profile_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Save the caller's subscription on a space they have a profile on.
-- The endpoint is a secret URL the browser holds: whoever sends it owns that browser now,
-- so a row left by another account on the same browser is replaced.
create function public.save_push_subscription(
  target_space uuid, target_endpoint text, key_p256dh text, key_auth text, agent text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.has_space_profile(target_space, me) then
    raise exception 'no profile on this space' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = target_endpoint;
  insert into public.push_subscriptions (space_id, profile_id, endpoint, p256dh, auth, user_agent)
    values (target_space, me, target_endpoint, key_p256dh, key_auth, agent);
end;
$$;
revoke execute on function public.save_push_subscription(uuid, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(uuid, text, text, text, text) to authenticated;
