-- Coupons, bumps, upsells (Launch 6 item 12, G23): constraints, offers.manage-only coupons,
-- links kept in their space, order extras, fulfil_order grants the bump offer too.
begin;
select plan(20);

do $$
declare
  sp uuid := '21000000-0000-4000-8000-000000000001';
  other uuid := '21000000-0000-4000-8000-000000000002';
begin
  perform tests.create_supabase_user('cpn_admin');
  perform tests.create_supabase_user('cpn_assistant');
  perform tests.create_supabase_user('cpn_buyer', 'cpn_buyer@test');
  insert into public.spaces (id, slug, name, status) values
    (sp, 'cpn-space', 'Coupon space', 'live'),
    (other, 'cpn-other', 'Other space', 'live');
  insert into public.space_members values
    (sp, tests.get_supabase_uid('cpn_admin'), 'admin', now()),
    (sp, tests.get_supabase_uid('cpn_assistant'), 'assistant', now());
  insert into public.products (id, space_id, kind, slug, title, status) values
    ('21a00000-0000-4000-8000-000000000001', sp, 'program', 'cpn-main', 'Main', 'published'),
    ('21a00000-0000-4000-8000-000000000002', sp, 'program', 'cpn-extra', 'Extra', 'published');
  insert into public.offers (id, space_id, slug, title, price_cents, currency, status) values
    ('21b00000-0000-4000-8000-000000000001', sp, 'cpn-main', 'Main', 4900, 'EUR', 'published'),
    ('21b00000-0000-4000-8000-000000000002', sp, 'cpn-bump', 'Bump', 900, 'EUR', 'published'),
    ('21b00000-0000-4000-8000-000000000003', other, 'cpn-foreign', 'Foreign', 100, 'EUR', 'published');
  insert into public.offer_products (offer_id, product_id) values
    ('21b00000-0000-4000-8000-000000000001', '21a00000-0000-4000-8000-000000000001'),
    ('21b00000-0000-4000-8000-000000000002', '21a00000-0000-4000-8000-000000000001'),
    ('21b00000-0000-4000-8000-000000000002', '21a00000-0000-4000-8000-000000000002');
  insert into public.coupons (id, space_id, code, percent_off) values
    ('21c00000-0000-4000-8000-000000000001', sp, 'CPN-TEN', 10);
  insert into public.coupon_offers (coupon_id, offer_id, space_id) values
    ('21c00000-0000-4000-8000-000000000001', '21b00000-0000-4000-8000-000000000001', sp);
end $$;

-- Coupon constraints.
select throws_ok($$ insert into public.coupons (space_id, code, percent_off)
  values ('21000000-0000-4000-8000-000000000001', 'lower', 10) $$, '23514', null, 'code must be uppercase');
select throws_ok($$ insert into public.coupons (space_id, code, percent_off)
  values ('21000000-0000-4000-8000-000000000001', 'CPN-TEN', 5) $$, '23505', null, 'code unique per space');
select throws_ok($$ insert into public.coupons (space_id, code, percent_off, amount_off_cents, currency)
  values ('21000000-0000-4000-8000-000000000001', 'CPN-BOTH', 10, 500, 'EUR') $$, '23514', null, 'one discount kind only');
select throws_ok($$ insert into public.coupons (space_id, code, amount_off_cents)
  values ('21000000-0000-4000-8000-000000000001', 'CPN-NOCUR', 500) $$, '23514', null, 'amount needs a currency');
select throws_ok($$ insert into public.coupons (space_id, code, percent_off)
  values ('21000000-0000-4000-8000-000000000001', 'CPN-101', 101) $$, '23514', null, 'percent at most 100');
select throws_ok($$ insert into public.coupon_offers (coupon_id, offer_id, space_id)
  values ('21c00000-0000-4000-8000-000000000001', '21b00000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001') $$,
  '23503', null, 'coupon cannot link an offer of another space');

-- Offer links.
select throws_ok($$ update public.offers set bump_offer_id = id where id = '21b00000-0000-4000-8000-000000000001' $$,
  '23514', null, 'offer cannot bump itself');
select throws_ok($$ update public.offers set upsell_offer_id = '21b00000-0000-4000-8000-000000000003'
  where id = '21b00000-0000-4000-8000-000000000001' $$, '23503', null, 'upsell must be in the same space');
update public.offers set bump_offer_id = '21b00000-0000-4000-8000-000000000002', upsell_offer_id = '21b00000-0000-4000-8000-000000000002'
  where id = '21b00000-0000-4000-8000-000000000001';

-- RLS: coupons are offers.manage only.
select tests.authenticate_as('cpn_admin');
select results_eq($$ select code from public.coupons where space_id = '21000000-0000-4000-8000-000000000001' $$,
  $$ values ('CPN-TEN') $$, 'offers.manage reads coupons');
select lives_ok($$ insert into public.coupons (space_id, code, amount_off_cents, currency)
  values ('21000000-0000-4000-8000-000000000001', 'CPN-FIVE', 500, 'EUR') $$, 'offers.manage creates coupons');
select results_eq($$ select count(*)::int from public.coupon_offers where space_id = '21000000-0000-4000-8000-000000000001' $$,
  $$ values (1) $$, 'offers.manage reads coupon offers');
select tests.authenticate_as('cpn_assistant');
select is_empty($$ select 1 from public.coupons where space_id = '21000000-0000-4000-8000-000000000001' $$, 'assistant reads no coupons');
select throws_ok($$ insert into public.coupons (space_id, code, percent_off)
  values ('21000000-0000-4000-8000-000000000001', 'CPN-SNEAK', 50) $$, '42501', null, 'assistant cannot create coupons');
select tests.authenticate_as('cpn_buyer');
select is_empty($$ select 1 from public.coupons where space_id = '21000000-0000-4000-8000-000000000001' $$, 'buyer reads no coupons');
reset role;

-- Order extras.
select throws_ok($$ insert into public.orders (space_id, offer_id, email, provider, provider_order_id, amount_cents, currency,
    livemode, waiver_version, waiver_accepted_at, discount_cents)
  values ('21000000-0000-4000-8000-000000000001', '21b00000-0000-4000-8000-000000000001', 'cpn_buyer@test', 'fake', 'CPN-PO-X',
    4410, 'EUR', false, 'v1', now(), 490) $$, '23514', null, 'a discount needs a coupon');
insert into public.orders (id, space_id, offer_id, email, provider, provider_order_id, amount_cents, currency, livemode,
  waiver_version, waiver_accepted_at, coupon_id, discount_cents, bump_offer_id, bump_cents)
values ('21d00000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '21b00000-0000-4000-8000-000000000001',
  'cpn_buyer@test', 'fake', 'CPN-PO-1', 5310, 'EUR', false, 'v1', now(),
  '21c00000-0000-4000-8000-000000000001', 490, '21b00000-0000-4000-8000-000000000002', 900);
select throws_ok($$ delete from public.coupons where id = '21c00000-0000-4000-8000-000000000001' $$,
  '23503', null, 'a used coupon cannot be deleted');
select throws_ok($$ delete from public.offers where id = '21b00000-0000-4000-8000-000000000002' $$,
  '23503', null, 'a sold bump offer cannot be deleted');

-- Fulfilment grants offer + bump products once each.
select is((public.fulfil_order('21d00000-0000-4000-8000-000000000001', 'CPN-CAP-1', tests.get_supabase_uid('cpn_buyer'), 'buyer')).status,
  'paid', 'order with bump is paid');
select results_eq($$ select product_id from public.grants where order_id = '21d00000-0000-4000-8000-000000000001' order by product_id $$,
  $$ values ('21a00000-0000-4000-8000-000000000001'::uuid), ('21a00000-0000-4000-8000-000000000002'::uuid) $$,
  'grants the offer and bump products, shared product once');

-- Deleting an unsold upsell target clears the link.
update public.offers set upsell_offer_id = null where id = '21b00000-0000-4000-8000-000000000001';
insert into public.offers (id, space_id, slug, title, price_cents, currency) values
  ('21b00000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000001', 'cpn-up', 'Up', 100, 'EUR');
update public.offers set upsell_offer_id = '21b00000-0000-4000-8000-000000000004' where id = '21b00000-0000-4000-8000-000000000001';
delete from public.offers where id = '21b00000-0000-4000-8000-000000000004';
select results_eq($$ select upsell_offer_id, bump_offer_id from public.offers where id = '21b00000-0000-4000-8000-000000000001' $$,
  $$ values (null::uuid, '21b00000-0000-4000-8000-000000000002'::uuid) $$, 'deleted upsell offer clears only that link');

select * from finish(true);
rollback;
