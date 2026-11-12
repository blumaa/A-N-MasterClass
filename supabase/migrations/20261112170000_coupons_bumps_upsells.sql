-- Launch 6 item 12 (G23): coupons, order bumps, upsells. Mirrors src/lib/data/types.ts and
-- src/lib/data/fake/fakeCouponRepo.ts + fakeCommerceRepo.ts.
-- Price is always computed on the server from these rows. Coupon uses are not stored: they are
-- the coupon's orders past 'created', so the created -> paid flip in fulfilment counts them once.
-- Cross-row links use composite keys (id, space_id) so a link can never leave its space.

alter table public.offers add constraint offers_id_space unique (id, space_id);

-- Bump: an extra offer ticked at checkout (same PayPal order). Upsell: offered after a paid order.
alter table public.offers
  add column bump_offer_id uuid,
  add column upsell_offer_id uuid,
  add constraint offers_bump_space foreign key (bump_offer_id, space_id)
    references public.offers (id, space_id) on delete set null (bump_offer_id),
  add constraint offers_upsell_space foreign key (upsell_offer_id, space_id)
    references public.offers (id, space_id) on delete set null (upsell_offer_id),
  add constraint offers_bump_not_self check (bump_offer_id <> id),
  add constraint offers_upsell_not_self check (upsell_offer_id <> id);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  code text not null constraint coupons_code check (code ~ '^[A-Z0-9_-]{3,32}$'),
  percent_off integer,
  amount_off_cents integer,
  currency text check (currency in ('EUR', 'USD', 'GBP', 'CHF')),
  -- null = unlimited.
  max_uses integer constraint coupons_max_uses check (max_uses is null or max_uses >= 1),
  once_per_customer boolean not null default false,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Exactly one discount kind; an amount carries its currency.
  constraint coupons_discount check (
    (percent_off between 1 and 100 and amount_off_cents is null and currency is null)
    or (percent_off is null and amount_off_cents between 1 and 9999999 and currency is not null)
  ),
  constraint coupons_code_taken unique (space_id, code),
  constraint coupons_id_space unique (id, space_id)
);

create table public.coupon_offers (
  coupon_id uuid not null,
  offer_id uuid not null,
  space_id uuid not null,
  primary key (coupon_id, offer_id),
  constraint coupon_offers_coupon_space foreign key (coupon_id, space_id)
    references public.coupons (id, space_id) on delete cascade,
  constraint coupon_offers_offer_space foreign key (offer_id, space_id)
    references public.offers (id, space_id) on delete cascade
);
create index coupon_offers_offer on public.coupon_offers (offer_id);

-- Order extras. amount_cents stays the paid total (offer - discount + bump).
alter table public.orders
  add column coupon_id uuid,
  add column discount_cents integer not null default 0 check (discount_cents >= 0),
  add column bump_offer_id uuid,
  add column bump_cents integer not null default 0 check (bump_cents >= 0),
  -- restrict: a used coupon or sold bump cannot be deleted (deactivate / unpublish instead).
  add constraint orders_coupon_space foreign key (coupon_id, space_id)
    references public.coupons (id, space_id) on delete restrict,
  add constraint orders_bump_space foreign key (bump_offer_id, space_id)
    references public.offers (id, space_id) on delete restrict,
  add constraint orders_extras check (
    (coupon_id is not null or discount_cents = 0) and (bump_offer_id is not null or bump_cents = 0)
  );
create index orders_coupon on public.orders (coupon_id) where coupon_id is not null;
create index orders_bump on public.orders (bump_offer_id) where bump_offer_id is not null;

alter table public.coupons enable row level security;
alter table public.coupon_offers enable row level security;

-- Codes are secret-ish: only offers.manage reads them. Checkout validates as service_role.
create policy coupons_all on public.coupons for all
  using (public.has_capability(space_id, 'offers.manage'))
  with check (public.has_capability(space_id, 'offers.manage'));
create policy coupon_offers_all on public.coupon_offers for all
  using (public.has_capability(space_id, 'offers.manage'))
  with check (public.has_capability(space_id, 'offers.manage'));

-- fulfil_order: also grants the bump offer's products.
create or replace function public.fulfil_order(target_order uuid, capture text, buyer uuid, display_name text)
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

  insert into public.grants (product_id, profile_id, access_group_id, source, order_id)
  select distinct op.product_id, buyer, op.access_group_id, 'purchase', o.id
  from public.offer_products op
  where op.offer_id = o.offer_id or op.offer_id = o.bump_offer_id
  on conflict (product_id, profile_id, coalesce(access_group_id, '00000000-0000-0000-0000-000000000000'::uuid))
    where status = 'active' do nothing;

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
