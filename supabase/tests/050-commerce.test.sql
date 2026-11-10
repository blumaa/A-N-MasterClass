-- Commerce: offer visibility, order/contacts privacy, owner-only credentials, idempotent
-- fulfilment, refund revokes, single-use claim links, service-role-only RPCs.
begin;
select plan(28);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  n uuid := '22222222-2222-4222-8222-222222222222';
  prog uuid := '33333333-3333-4333-8333-333333333333';
  other_prog uuid := '44444444-4444-4444-8444-444444444444';
  full_offer uuid := '55555555-5555-4555-8555-555555555555';
  draft_offer uuid := '66666666-6666-4666-8666-666666666666';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('admin');
  perform tests.create_supabase_user('support');
  perform tests.create_supabase_user('assistant');
  perform tests.create_supabase_user('other_owner');
  perform tests.create_supabase_user('buyer', 'buyer@test');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live'), (n, 'natasha', 'Natasha', 'live');
  insert into public.space_members values
    (a, tests.get_supabase_uid('owner'), 'owner', now()),
    (a, tests.get_supabase_uid('admin'), 'admin', now()),
    (a, tests.get_supabase_uid('support'), 'support', now()),
    (a, tests.get_supabase_uid('assistant'), 'assistant', now()),
    (n, tests.get_supabase_uid('other_owner'), 'owner', now());
  insert into public.products (id, space_id, kind, slug, title, status) values
    (prog, a, 'program', 'rope-1', 'Rope 1', 'published'),
    (other_prog, n, 'program', 'other', 'Other', 'published');
  insert into public.programs (product_id) values (prog), (other_prog);
  insert into public.offers (id, space_id, slug, title, price_cents, currency, status) values
    (full_offer, a, 'full', 'Full access', 4900, 'EUR', 'published'),
    (draft_offer, a, 'later', 'Later', 1000, 'EUR', 'draft');
  insert into public.offer_products (offer_id, product_id) values (full_offer, prog);
  insert into public.orders (id, space_id, offer_id, email, provider, provider_order_id, amount_cents, currency,
                             livemode, waiver_version, waiver_accepted_at, marketing_consent)
  values ('77777777-7777-4777-8777-777777777777', a, full_offer, 'buyer@test', 'paypal', 'PO-1', 4900, 'EUR',
          false, 'v1', now(), true);
  insert into public.payment_credentials (space_id, env, client_id) values (a, 'sandbox', 'cid');
  insert into public.claim_tokens (token_hash, space_id, profile_id, expires_at) values
    (repeat('a', 64), a, tests.get_supabase_uid('buyer'), now() + interval '10 days'),
    (repeat('b', 64), a, tests.get_supabase_uid('buyer'), now() - interval '1 second');
end $$;

-- Shape guards
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency)
  values ('11111111-1111-4111-8111-111111111111', 'full', 'Dup', 100, 'EUR') $$, '23505', null, 'offer slug unique per space');
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency)
  values ('11111111-1111-4111-8111-111111111111', 'big', 'Big', 10000000, 'EUR') $$, '23514', null, 'price above max refused');
select throws_ok($$ insert into public.offer_products (offer_id, product_id)
  values ('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444') $$, '23514', null, 'product of another space refused');
select throws_ok($$ delete from public.offers where id = '55555555-5555-4555-8555-555555555555' $$, '23503', null, 'offer with orders cannot be deleted');
select throws_ok($$ insert into public.orders (space_id, offer_id, email, provider, provider_order_id, amount_cents, currency, livemode, waiver_version, waiver_accepted_at)
  values ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'x@test', 'paypal', 'PO-1', 4900, 'EUR', false, 'v1', now()) $$,
  '23505', null, 'provider order id unique');
select throws_ok($$ insert into public.orders (space_id, offer_id, email, provider, provider_order_id, amount_cents, currency, livemode, waiver_version, waiver_accepted_at)
  values ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'X@Test', 'paypal', 'PO-2', 4900, 'EUR', false, 'v1', now()) $$,
  '23514', null, 'order email stored lowercase');

-- Visibility
select tests.clear_authentication();
select results_eq($$ select slug from public.offers $$, $$ values ('full') $$, 'anon reads published offers only');
select is_empty($$ select 1 from public.orders $$, 'anon reads no orders');
select is_empty($$ select 1 from public.claim_tokens $$, 'anon reads no claim tokens');

select tests.authenticate_as('assistant');
select is_empty($$ select 1 from public.orders $$, 'assistant reads no orders');
select is_empty($$ select 1 from public.contacts $$, 'assistant reads no contacts');
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency)
  values ('11111111-1111-4111-8111-111111111111', 'new', 'New', 100, 'EUR') $$, '42501', null, 'assistant cannot create offers');

select tests.authenticate_as('support');
select results_eq($$ select email from public.orders $$, $$ values ('buyer@test') $$, 'support (customers.manage) reads orders');
select lives_ok($$ update public.orders set status = 'paid' $$, 'staff update runs (RLS filters it)');
select results_eq($$ select status from public.orders $$, $$ values ('created') $$, 'staff cannot change orders: no write policy');

select tests.authenticate_as('admin');
select is_empty($$ select 1 from public.payment_credentials $$, 'admin cannot read payment credentials');
select lives_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency)
  values ('11111111-1111-4111-8111-111111111111', 'new', 'New', 100, 'EUR') $$, 'admin (offers.manage) creates offers');

select tests.authenticate_as('owner');
select results_eq($$ select client_id from public.payment_credentials $$, $$ values ('cid') $$, 'owner reads own credentials');
select throws_ok($$ select public.payment_secret('11111111-1111-4111-8111-111111111111', 'sandbox') $$, '42501', null, 'owner cannot call payment_secret');
select throws_ok($$ select public.fulfil_order('77777777-7777-4777-8777-777777777777', 'CAP-1', auth.uid(), 'x') $$, '42501', null, 'browser roles cannot fulfil orders');

select tests.authenticate_as('other_owner');
select is_empty($$ select 1 from public.offers where space_id = '11111111-1111-4111-8111-111111111111' and status = 'draft' $$, 'other space owner sees no drafts');

-- Service role: fulfilment, refund, claim links, secrets
select tests.authenticate_as_service_role();
select is((public.fulfil_order('77777777-7777-4777-8777-777777777777', 'CAP-1', tests.get_supabase_uid('buyer'), 'buyer')).status,
  'paid', 'fulfil_order marks paid');
select is((public.fulfil_order('77777777-7777-4777-8777-777777777777', 'CAP-2', tests.get_supabase_uid('buyer'), 'buyer')).capture_id,
  'CAP-1', 'second fulfilment returns the order unchanged');
select results_eq($$ select count(*)::int, bool_and(source = 'purchase') from public.grants where order_id = '77777777-7777-4777-8777-777777777777' $$,
  $$ values (1, true) $$, 'one purchase grant per product');
select results_eq($$ select email, marketing_consent, consent_source from public.contacts $$,
  $$ values ('buyer@test'::text, true, 'checkout'::text) $$, 'contact recorded with consent');

do $$ begin perform public.set_order_status('77777777-7777-4777-8777-777777777777', 'refunded'); end $$;
select is_empty($$ select 1 from public.grants where order_id = '77777777-7777-4777-8777-777777777777' and status = 'active' $$, 'full refund revokes grants');

select results_eq($$ select count(*)::int from public.consume_claim_token('11111111-1111-4111-8111-111111111111', repeat('a', 64)) $$,
  $$ values (1) $$, 'valid claim token consumed once');
select results_eq($$ select
    (select count(*)::int from public.consume_claim_token('11111111-1111-4111-8111-111111111111', repeat('a', 64)))
  + (select count(*)::int from public.consume_claim_token('11111111-1111-4111-8111-111111111111', repeat('b', 64)))
  + (select count(*)::int from public.consume_claim_token('22222222-2222-4222-8222-222222222222', repeat('a', 64))) $$,
  $$ values (0) $$, 'used, expired and other-space tokens refused');

select * from finish(true);
rollback;
