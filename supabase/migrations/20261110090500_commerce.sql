-- Commerce (G3, G4, G5, G10, G16, G25, G28): offers, orders, per-space PayPal credentials,
-- contacts, claim links. One-time offers only in v1. Mirrors src/lib/data/types.ts and
-- src/lib/data/fake/fakeCommerceRepo.ts; sqlMirror.test.ts keeps enum lists equal.
-- Writes that money depends on (orders, grants by purchase, claim links) run as service_role
-- through the definer RPCs below; browser roles only read.

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  slug text not null constraint offers_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  title text not null check (length(trim(title)) > 0),
  description text,
  -- Tax-inclusive cents (G3). 0 = free offer. Upper bound mirrors MAX_PRICE_CENTS.
  price_cents integer not null constraint offers_price check (price_cents between 0 and 9999999),
  currency text not null check (currency in ('EUR', 'USD', 'GBP', 'CHF')),
  -- Room for subscription / payment_plan later (G5).
  kind text not null default 'one_time' check (kind in ('one_time')),
  access_days integer check (access_days is null or access_days > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_slug_taken unique (space_id, slug)
);

create table public.offer_products (
  offer_id uuid not null references public.offers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  access_group_id uuid,
  primary key (offer_id, product_id)
);
create index offer_products_product on public.offer_products (product_id);

-- Products must belong to the offer's space.
create function public.offer_products_same_space() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select o.space_id from public.offers o where o.id = new.offer_id)
     is distinct from (select p.space_id from public.products p where p.id = new.product_id) then
    raise exception 'product not in offer space' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger offer_products_same_space
  before insert or update on public.offer_products
  for each row execute function public.offer_products_same_space();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- restrict: an offer with orders cannot be deleted (unpublish instead).
  offer_id uuid not null references public.offers (id) on delete restrict,
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  provider text not null constraint orders_provider check (provider in ('paypal', 'fake', 'free')),
  provider_order_id text not null,
  capture_id text,
  status text not null default 'created' constraint orders_status check (status in ('created', 'paid', 'partially_refunded', 'refunded')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency in ('EUR', 'USD', 'GBP', 'CHF')),
  -- false = sandbox/fake; kept out of revenue (G10).
  livemode boolean not null,
  -- Withdrawal waiver for digital content (G25).
  waiver_version text not null check (length(waiver_version) > 0),
  waiver_accepted_at timestamptz not null,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (provider, provider_order_id),
  unique (provider, capture_id),
  constraint orders_paid_has_buyer check (status = 'created' or (profile_id is not null and paid_at is not null)),
  constraint orders_free_is_zero check (provider <> 'free' or amount_cents = 0)
);
create index orders_space on public.orders (space_id, created_at desc);
create index orders_offer on public.orders (offer_id);
create index orders_profile on public.orders (profile_id);

-- The order that paid for a grant; a full refund revokes it (G28).
alter table public.grants add column order_id uuid references public.orders (id) on delete set null;
create index grants_order on public.grants (order_id) where order_id is not null;

-- One PayPal REST app per space and env (G28). The secret is in Vault; only its id is here.
create table public.payment_credentials (
  space_id uuid not null references public.spaces (id) on delete cascade,
  provider text not null default 'paypal' check (provider in ('paypal')),
  env text not null constraint payment_credentials_env check (env in ('sandbox', 'live')),
  client_id text not null check (length(trim(client_id)) > 0),
  webhook_id text,
  secret_id uuid,
  updated_at timestamptz not null default now(),
  primary key (space_id, provider, env)
);

-- Buyers, students, opt-ins for the instructor's own mailing tool (G16). Email stored lowercase.
create table public.contacts (
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  profile_id uuid references public.profiles (id) on delete set null,
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  consent_source text,
  created_at timestamptz not null default now(),
  primary key (space_id, email),
  constraint contacts_consent_recorded check (not marketing_consent or (consent_at is not null and consent_source is not null))
);

-- 10-day single-use claim link (G4). Only the sha256 hex of the token is stored.
create table public.claim_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  space_id uuid not null references public.spaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.offers enable row level security;
alter table public.offer_products enable row level security;
alter table public.orders enable row level security;
alter table public.payment_credentials enable row level security;
alter table public.contacts enable row level security;
alter table public.claim_tokens enable row level security;

-- Offers: visitors read published ones (checkout page, offer section); offers.manage edits all.
create policy offers_read on public.offers for select
  using (status = 'published' or public.has_capability(space_id, 'offers.manage'));
create policy offers_write on public.offers for all
  using (public.has_capability(space_id, 'offers.manage'))
  with check (public.has_capability(space_id, 'offers.manage'));

create policy offer_products_read on public.offer_products for select
  using (exists (
    select 1 from public.offers o where o.id = offer_id
      and (o.status = 'published' or public.has_capability(o.space_id, 'offers.manage'))
  ));
create policy offer_products_write on public.offer_products for all
  using (public.has_capability((select o.space_id from public.offers o where o.id = offer_id), 'offers.manage'))
  with check (public.has_capability((select o.space_id from public.offers o where o.id = offer_id), 'offers.manage'));

-- Orders: buyer reads own, customers.manage + offers.manage (sold counts) read the space.
-- No write policy: created and fulfilled by the server (service_role) only.
create policy orders_read on public.orders for select
  using (
    profile_id = auth.uid()
    or public.has_capability(space_id, 'customers.manage')
    or public.has_capability(space_id, 'offers.manage')
  );

-- Credentials: owner only (payments.manage, G15). Secret never readable here.
create policy payment_credentials_all on public.payment_credentials for all
  using (public.has_capability(space_id, 'payments.manage'))
  with check (public.has_capability(space_id, 'payments.manage'));

create policy contacts_read on public.contacts for select
  using (public.has_capability(space_id, 'customers.manage'));

-- claim_tokens: no policy. Service role only.

-- ---------------------------------------------------------------------------
-- RPCs (service_role only)
-- ---------------------------------------------------------------------------

-- Stores or replaces a space's PayPal secret in Vault. null keeps the stored one.
create function public.save_payment_secret(target_space uuid, target_env text, secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  existing uuid;
begin
  select c.secret_id into existing from public.payment_credentials c
  where c.space_id = target_space and c.provider = 'paypal' and c.env = target_env
  for update;
  if not found then
    raise exception 'save credentials before the secret' using errcode = '23503';
  end if;
  if secret is null then
    return;
  end if;
  if existing is null then
    update public.payment_credentials
    set secret_id = vault.create_secret(secret, 'paypal:' || target_space || ':' || target_env)
    where space_id = target_space and provider = 'paypal' and env = target_env;
  else
    perform vault.update_secret(existing, secret);
  end if;
end;
$$;

create function public.payment_secret(target_space uuid, target_env text) returns text
language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from public.payment_credentials c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.space_id = target_space and c.provider = 'paypal' and c.env = target_env;
$$;

-- Atomic, idempotent fulfilment (G4, G28). The app checks the capture against the order and
-- resolves the buyer's profile (auth user) first. Locks the order row: capture route and
-- webhook racing on the same order grant once. Already fulfilled = returned unchanged.
create function public.fulfil_order(target_order uuid, capture text, buyer uuid, display_name text)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = target_order for update;
  if not found then
    raise exception 'order % not found', target_order using errcode = 'P0002';
  end if;
  if o.status <> 'created' then
    return o;
  end if;
  if capture is null and o.provider <> 'free' then
    raise exception 'order % needs a capture', target_order using errcode = '23514';
  end if;

  insert into public.space_profiles (space_id, profile_id, display_name)
  values (o.space_id, buyer, display_name)
  on conflict (space_id, profile_id) do nothing;

  insert into public.grants (product_id, profile_id, source, order_id)
  select op.product_id, buyer, 'purchase', o.id
  from public.offer_products op
  where op.offer_id = o.offer_id
  on conflict (product_id, profile_id) where status = 'active' do nothing;

  -- Consent is never withdrawn by a purchase; first opt-in wins.
  insert into public.contacts (space_id, email, profile_id, marketing_consent, consent_at, consent_source)
  values (
    o.space_id, o.email, buyer, o.marketing_consent,
    case when o.marketing_consent then o.created_at end,
    case when o.marketing_consent then 'checkout' end
  )
  on conflict (space_id, email) do update set
    profile_id = excluded.profile_id,
    marketing_consent = public.contacts.marketing_consent or excluded.marketing_consent,
    consent_at = case when public.contacts.marketing_consent then public.contacts.consent_at else excluded.consent_at end,
    consent_source = case when public.contacts.marketing_consent then public.contacts.consent_source else excluded.consent_source end;

  update public.orders
  set status = 'paid', capture_id = coalesce(capture, capture_id), profile_id = buyer, paid_at = now()
  where id = o.id
  returning * into o;
  return o;
end;
$$;

-- Capture status change from PayPal (G28). A full refund revokes the order's grants.
create function public.set_order_status(target_order uuid, new_status text) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  update public.orders set status = new_status where id = target_order returning * into o;
  if not found then
    raise exception 'order % not found', target_order using errcode = 'P0002';
  end if;
  if new_status = 'refunded' then
    update public.grants set status = 'revoked' where order_id = target_order and status = 'active';
  end if;
  return o;
end;
$$;

-- Marks a valid (unused, unexpired, same space) claim link used and returns it; else no row.
create function public.consume_claim_token(target_space uuid, hash text) returns setof public.claim_tokens
language sql security definer set search_path = '' as $$
  update public.claim_tokens
  set used_at = now()
  where token_hash = hash and space_id = target_space and used_at is null and expires_at > now()
  returning *;
$$;

revoke execute on function public.save_payment_secret(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.payment_secret(uuid, text) from public, anon, authenticated;
revoke execute on function public.fulfil_order(uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.set_order_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.consume_claim_token(uuid, text) from public, anon, authenticated;
grant execute on function public.save_payment_secret(uuid, text, text) to service_role;
grant execute on function public.payment_secret(uuid, text) to service_role;
grant execute on function public.fulfil_order(uuid, text, uuid, text) to service_role;
grant execute on function public.set_order_status(uuid, text) to service_role;
grant execute on function public.consume_claim_token(uuid, text) to service_role;
