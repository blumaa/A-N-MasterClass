-- Subscriptions and payment plans (Launch 6 item 13, G5): offer price-type terms, subscription
-- constraints, buyer/staff-only reads, no browser writes, idempotent payment recording.
begin;
select plan(23);

do $$
declare
  sp uuid := '22000000-0000-4000-8000-000000000001';
begin
  perform tests.create_supabase_user('sub_admin');
  perform tests.create_supabase_user('sub_assistant');
  perform tests.create_supabase_user('sub_buyer', 'sub_buyer@test');
  perform tests.create_supabase_user('sub_other', 'sub_other@test');
  insert into public.spaces (id, slug, name, status) values (sp, 'sub-space', 'Subscription space', 'live');
  insert into public.space_members values
    (sp, tests.get_supabase_uid('sub_admin'), 'admin', now()),
    (sp, tests.get_supabase_uid('sub_assistant'), 'assistant', now());
  insert into public.offers (id, space_id, slug, title, price_cents, currency, status, kind, billing_interval, trial_days, installments) values
    ('22b00000-0000-4000-8000-000000000001', sp, 'sub-monthly', 'Monthly', 1500, 'EUR', 'published', 'subscription', 'month', 7, null),
    ('22b00000-0000-4000-8000-000000000002', sp, 'sub-plan', 'Plan', 5000, 'EUR', 'published', 'payment_plan', 'month', null, 3);
  insert into public.subscriptions (id, space_id, offer_id, profile_id, email, kind, provider, provider_subscription_id, status,
      amount_cents, currency, billing_interval, trial_days, installments, livemode, waiver_version, waiver_accepted_at) values
    ('22c00000-0000-4000-8000-000000000001', sp, '22b00000-0000-4000-8000-000000000001', tests.get_supabase_uid('sub_buyer'),
      'sub_buyer@test', 'subscription', 'fake', 'SUB-I-1', 'active', 1500, 'EUR', 'month', 7, null, false, 'v1', now()),
    ('22c00000-0000-4000-8000-000000000002', sp, '22b00000-0000-4000-8000-000000000002', tests.get_supabase_uid('sub_buyer'),
      'sub_buyer@test', 'payment_plan', 'fake', 'SUB-I-2', 'past_due', 5000, 'EUR', 'month', null, 3, false, 'v1', now());
end $$;

-- Offer terms (Kajabi limits).
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency, billing_interval)
  values ('22000000-0000-4000-8000-000000000001', 'sub-bad1', 'x', 100, 'EUR', 'month') $$,
  '23514', null, 'one-time offer has no interval');
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency, kind)
  values ('22000000-0000-4000-8000-000000000001', 'sub-bad2', 'x', 100, 'EUR', 'subscription') $$,
  '23514', null, 'subscription needs an interval');
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency, kind, billing_interval)
  values ('22000000-0000-4000-8000-000000000001', 'sub-bad3', 'x', 0, 'EUR', 'subscription', 'month') $$,
  '23514', null, 'subscription is never free');
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency, kind, billing_interval, installments)
  values ('22000000-0000-4000-8000-000000000001', 'sub-bad4', 'x', 100, 'EUR', 'payment_plan', 'month', 25) $$,
  '23514', null, 'monthly plan at most 24 payments');
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency, kind, billing_interval, installments)
  values ('22000000-0000-4000-8000-000000000001', 'sub-bad5', 'x', 100, 'EUR', 'payment_plan', 'year', 6) $$,
  '23514', null, 'annual plan at most 5 payments');
select throws_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency, kind, billing_interval, installments, trial_days)
  values ('22000000-0000-4000-8000-000000000001', 'sub-bad6', 'x', 100, 'EUR', 'payment_plan', 'month', 3, 7) $$,
  '23514', null, 'payment plan has no trial');
select lives_ok($$ insert into public.offers (space_id, slug, title, price_cents, currency, kind, billing_interval, installments)
  values ('22000000-0000-4000-8000-000000000001', 'sub-weekly', 'x', 100, 'EUR', 'payment_plan', 'week', 104) $$,
  'weekly plan allows 104 payments');

-- Subscription constraints.
select throws_ok($$ insert into public.subscriptions (space_id, offer_id, email, kind, provider, provider_subscription_id, status,
    amount_cents, currency, billing_interval, livemode, waiver_version, waiver_accepted_at)
  values ('22000000-0000-4000-8000-000000000001', '22b00000-0000-4000-8000-000000000001', 'sub_x@test', 'subscription', 'fake',
    'SUB-I-3', 'active', 1500, 'EUR', 'month', false, 'v1', now()) $$, '23514', null, 'active subscription needs a buyer');
select throws_ok($$ insert into public.subscriptions (space_id, offer_id, email, kind, provider, provider_subscription_id,
    amount_cents, currency, billing_interval, livemode, waiver_version, waiver_accepted_at)
  values ('22000000-0000-4000-8000-000000000001', '22b00000-0000-4000-8000-000000000001', 'sub_x@test', 'payment_plan', 'fake',
    'SUB-I-4', 1500, 'EUR', 'month', false, 'v1', now()) $$, '23514', null, 'payment plan needs installments');
select throws_ok($$ insert into public.subscriptions (space_id, offer_id, email, kind, provider, provider_subscription_id,
    amount_cents, currency, billing_interval, livemode, waiver_version, waiver_accepted_at)
  values ('22000000-0000-4000-8000-000000000001', '22b00000-0000-4000-8000-000000000001', 'sub_x@test', 'subscription', 'fake',
    'SUB-I-1', 1500, 'EUR', 'month', false, 'v1', now()) $$, '23505', null, 'provider subscription id unique');
select throws_ok($$ delete from public.offers where id = '22b00000-0000-4000-8000-000000000001' $$,
  '23503', null, 'offer with subscriptions cannot be deleted');

-- Payments: idempotent per sale, past_due cleared, last plan payment completes.
select is(public.record_subscription_payment('22c00000-0000-4000-8000-000000000002', 'SUB-SALE-1', 5000, '2026-01-01T00:00:00Z'),
  true, 'first sale recorded');
select is(public.record_subscription_payment('22c00000-0000-4000-8000-000000000002', 'SUB-SALE-1', 5000, '2026-01-01T00:00:00Z'),
  false, 'same sale again is a no-op');
select results_eq($$ select status, payments_made, current_period_end from public.subscriptions
  where id = '22c00000-0000-4000-8000-000000000002' $$,
  $$ values ('active'::text, 1, '2026-02-01T00:00:00Z'::timestamptz) $$, 'payment clears past_due and extends the period');
do $$
begin
  perform public.record_subscription_payment('22c00000-0000-4000-8000-000000000002', 'SUB-SALE-2', 5000, '2026-02-01T00:00:00Z');
  perform public.record_subscription_payment('22c00000-0000-4000-8000-000000000002', 'SUB-SALE-3', 5000, '2026-03-01T00:00:00Z');
end $$;
select results_eq($$ select status, payments_made from public.subscriptions where id = '22c00000-0000-4000-8000-000000000002' $$,
  $$ values ('completed'::text, 3) $$, 'last payment completes the plan');
select results_eq($$ select count(*)::int from public.subscription_payments where subscription_id = '22c00000-0000-4000-8000-000000000002' $$,
  $$ values (3) $$, 'one row per sale');

-- RLS.
select tests.authenticate_as('sub_buyer');
select results_eq($$ select count(*)::int from public.subscriptions where space_id = '22000000-0000-4000-8000-000000000001' $$,
  $$ values (2) $$, 'buyer reads own subscriptions');
select results_eq($$ select count(*)::int from public.subscription_payments where space_id = '22000000-0000-4000-8000-000000000001' $$,
  $$ values (3) $$, 'buyer reads own payments');
select throws_ok($$ select public.record_subscription_payment('22c00000-0000-4000-8000-000000000001', 'SUB-SALE-X', 1500, now()) $$,
  '42501', null, 'buyer cannot record payments');
select tests.authenticate_as('sub_other');
select is_empty($$ select 1 from public.subscriptions where space_id = '22000000-0000-4000-8000-000000000001' $$,
  'others read no subscriptions');
select tests.authenticate_as('sub_admin');
select results_eq($$ select count(*)::int from public.subscriptions where space_id = '22000000-0000-4000-8000-000000000001' $$,
  $$ values (2) $$, 'admin reads the space subscriptions');
select tests.authenticate_as('sub_assistant');
select is_empty($$ select 1 from public.subscriptions where space_id = '22000000-0000-4000-8000-000000000001' $$,
  'assistant reads no subscriptions');
reset role;

-- Browser roles never write subscriptions (no write policy).
select tests.authenticate_as('sub_admin');
update public.subscriptions set status = 'cancelled' where id = '22c00000-0000-4000-8000-000000000001';
reset role;
select results_eq($$ select status from public.subscriptions where id = '22c00000-0000-4000-8000-000000000001' $$,
  $$ values ('active'::text) $$, 'admin update is a no-op under RLS');

select * from finish(true);
rollback;
