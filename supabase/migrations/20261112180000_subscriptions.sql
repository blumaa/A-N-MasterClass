-- Subscriptions and payment plans (G5), mirroring Kajabi:
-- https://help.kajabi.com/en/articles/12695517-how-to-create-a-subscription-offer
-- https://help.kajabi.com/articles/sales/offers/create-a-payment-plan-offer
-- https://help.kajabi.com/en/articles/17174611-manage-failed-payments-with-kajabi-payments
-- A payment plan is a provider plan with a fixed number of cycles. Terms are copied onto the
-- subscription at checkout, so editing the offer never changes what an existing buyer pays.
-- Mirrors src/lib/commerce/recurring.ts and src/lib/data/fake/fakeSubscriptionRepo.ts;
-- sqlMirror.test.ts keeps enum lists equal. Browser roles only read; the server writes.

-- ---------------------------------------------------------------------------
-- Offer price types
-- ---------------------------------------------------------------------------

alter table public.offers drop constraint offers_kind_check;
alter table public.offers add constraint offers_kind check (kind in ('one_time', 'subscription', 'payment_plan'));

alter table public.offers
  add column billing_interval text constraint offers_billing_interval check (billing_interval in ('week', 'month', 'year')),
  add column trial_days integer constraint offers_trial_days check (trial_days between 1 and 365),
  add column installments integer;

-- One-time: no recurring terms. Subscription: interval, optional trial, never free.
-- Payment plan: interval, no trial, never free, Kajabi installment limits per interval.
alter table public.offers add constraint offers_recurring_terms check (
  case kind
    when 'one_time' then billing_interval is null and trial_days is null and installments is null
    when 'subscription' then billing_interval is not null and installments is null and price_cents > 0
    when 'payment_plan' then billing_interval is not null and trial_days is null and price_cents > 0
      and installments between 2 and case billing_interval when 'week' then 104 when 'month' then 24 else 5 end
  end
);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  offer_id uuid not null,
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  kind text not null constraint subscriptions_kind check (kind in ('subscription', 'payment_plan')),
  provider text not null constraint subscriptions_provider check (provider in ('paypal', 'fake')),
  provider_subscription_id text not null check (length(provider_subscription_id) > 0),
  status text not null default 'pending'
    constraint subscriptions_status check (status in ('pending', 'active', 'past_due', 'cancelled', 'completed')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency in ('EUR', 'USD', 'GBP', 'CHF')),
  billing_interval text not null constraint subscriptions_billing_interval check (billing_interval in ('week', 'month', 'year')),
  trial_days integer check (trial_days between 1 and 365),
  installments integer check (installments >= 2),
  payments_made integer not null default 0 check (payments_made >= 0),
  current_period_end timestamptz,
  ended_at timestamptz,
  -- false = sandbox/fake; kept out of revenue (G10).
  livemode boolean not null,
  waiver_version text not null check (length(waiver_version) > 0),
  waiver_accepted_at timestamptz not null,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  -- restrict: an offer with subscriptions cannot be deleted (unpublish instead).
  constraint subscriptions_offer_space foreign key (offer_id, space_id)
    references public.offers (id, space_id) on delete restrict,
  constraint subscriptions_provider_id unique (provider, provider_subscription_id),
  constraint subscriptions_terms check (
    (kind = 'subscription' and installments is null)
    or (kind = 'payment_plan' and installments is not null and trial_days is null)
  ),
  constraint subscriptions_active_has_buyer check (status = 'pending' or profile_id is not null)
);
create index subscriptions_space on public.subscriptions (space_id, created_at desc);
create index subscriptions_offer on public.subscriptions (offer_id);
create index subscriptions_profile on public.subscriptions (profile_id);

-- One row per provider sale. sale_id is the idempotency key for webhook retries.
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  provider text not null constraint subscription_payments_provider check (provider in ('paypal', 'fake')),
  sale_id text not null check (length(sale_id) > 0),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency in ('EUR', 'USD', 'GBP', 'CHF')),
  status text not null default 'paid' constraint subscription_payments_status check (status in ('paid', 'refunded')),
  livemode boolean not null,
  paid_at timestamptz not null,
  constraint subscription_payments_sale unique (provider, sale_id)
);
create index subscription_payments_subscription on public.subscription_payments (subscription_id, paid_at);
create index subscription_payments_space on public.subscription_payments (space_id, paid_at desc);

-- Provider billing plans are fixed once created; cached per offer, env and billed terms.
create table public.provider_plans (
  space_id uuid not null references public.spaces (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete cascade,
  provider text not null check (provider in ('paypal', 'fake')),
  livemode boolean not null,
  terms_key text not null check (length(terms_key) > 0),
  plan_id text not null check (length(plan_id) > 0),
  created_at timestamptz not null default now(),
  primary key (offer_id, provider, livemode, terms_key)
);

-- The subscription that pays for a grant. Its state drives the grant (G5).
alter table public.grants add column subscription_id uuid references public.subscriptions (id) on delete set null;
create index grants_subscription on public.grants (subscription_id) where subscription_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.provider_plans enable row level security;

-- Buyer reads own; customers.manage + offers.manage read the space. No write policy: the
-- server (service_role) creates and changes them, after checking the viewer itself.
create policy subscriptions_read on public.subscriptions for select
  using (
    profile_id = auth.uid()
    or public.has_capability(space_id, 'customers.manage')
    or public.has_capability(space_id, 'offers.manage')
  );

create policy subscription_payments_read on public.subscription_payments for select
  using (
    public.has_capability(space_id, 'customers.manage')
    or public.has_capability(space_id, 'offers.manage')
    or exists (select 1 from public.subscriptions s where s.id = subscription_id and s.profile_id = auth.uid())
  );

-- provider_plans: no policy. Service role only.

-- ---------------------------------------------------------------------------
-- RPC (service_role only)
-- ---------------------------------------------------------------------------

-- Records one paid sale, idempotent on (provider, sale_id). Locks the subscription so two
-- webhook deliveries count a payment once. A payment clears past_due; the last payment of a
-- payment plan completes it. Returns false when the sale was already recorded.
create function public.record_subscription_payment(
  target_subscription uuid, sale text, amount integer, paid timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions;
  inserted integer;
begin
  select * into s from public.subscriptions where id = target_subscription for update;
  if not found then
    raise exception 'subscription % not found', target_subscription using errcode = 'P0002';
  end if;

  insert into public.subscription_payments (subscription_id, space_id, provider, sale_id, amount_cents, currency, livemode, paid_at)
  values (s.id, s.space_id, s.provider, sale, amount, s.currency, s.livemode, paid)
  on conflict (provider, sale_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;

  update public.subscriptions set
    payments_made = s.payments_made + 1,
    current_period_end = greatest(
      s.current_period_end,
      paid + case s.billing_interval when 'week' then interval '7 days' when 'month' then interval '1 month' else interval '1 year' end
    ),
    status = case
      when s.status in ('active', 'past_due') and s.kind = 'payment_plan' and s.payments_made + 1 >= s.installments then 'completed'
      when s.status = 'past_due' then 'active'
      else s.status
    end
  where id = s.id;
  return true;
end;
$$;

revoke execute on function public.record_subscription_payment(uuid, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.record_subscription_payment(uuid, text, integer, timestamptz) to service_role;
