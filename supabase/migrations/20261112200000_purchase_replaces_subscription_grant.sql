-- fulfil_order: a purchase replaces a subscription grant with a permanent one (G5).
-- Without this, cancelling the subscription later would end access the buyer paid for once.
-- Same body as 20261112190000_grant_expiry_renewal.sql plus the subscription_id case.
-- Mirrors src/features/checkout/api/buyer.ts giveGrants.

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

  -- An expired grant (subscription cancelled at period end, G5) still has status active and
  -- would block the new grant under grants_one_active. A subscription grant would end with the
  -- subscription. Revoke both first so the purchase gives a permanent grant.
  update public.grants g set status = 'revoked'
  where g.profile_id = buyer and g.status = 'active' and (g.expires_at <= now() or g.subscription_id is not null)
    and exists (
      select 1 from public.offer_products op
      where (op.offer_id = o.offer_id or op.offer_id = o.bump_offer_id)
        and op.product_id = g.product_id and op.access_group_id is not distinct from g.access_group_id
    );

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
