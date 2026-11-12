-- Launch 6 item 6: push subscriptions. Own rows only; saved per space through save_push_subscription.
begin;
select plan(14);

do $$
declare
  s uuid := '16161616-1616-4616-8616-161616161616';
  other uuid := '16161616-1616-4616-8616-16161616161f';
begin
  perform tests.create_supabase_user('push-a');
  perform tests.create_supabase_user('push-b');
  perform tests.create_supabase_user('push-stranger');
  insert into public.spaces (id, slug, name, status) values
    (s, 'sqltest-push', 'SQL test', 'live'), (other, 'sqltest-push-other', 'SQL test', 'live');
  insert into public.space_profiles (space_id, profile_id, display_name) values
    (s, tests.get_supabase_uid('push-a'), 'A'), (s, tests.get_supabase_uid('push-b'), 'B');
end $$;

create function pg_temp.rows(what text) returns bigint language sql as $$
  select count(*) from public.push_subscriptions where endpoint like 'https://push.test/sqltest-push/' || what || '%';
$$;

-- Save
select tests.authenticate_as('push-a');
select lives_ok($$ select public.save_push_subscription('16161616-1616-4616-8616-161616161616',
  'https://push.test/sqltest-push/1', 'k', 'a', 'agent') $$, 'member saves on own space');
select lives_ok($$ select public.save_push_subscription('16161616-1616-4616-8616-161616161616',
  'https://push.test/sqltest-push/1', 'k2', 'a2', null) $$, 'saving again replaces');
select is(pg_temp.rows('1'), 1::bigint, 'one row per endpoint');
select is((select p256dh from public.push_subscriptions where endpoint = 'https://push.test/sqltest-push/1'), 'k2', 'keys updated');
select throws_ok($$ select public.save_push_subscription('16161616-1616-4616-8616-16161616161f',
  'https://push.test/sqltest-push/2', 'k', 'a', null) $$, '42501', null, 'no profile on that space');
select throws_ok($$ select public.save_push_subscription('16161616-1616-4616-8616-161616161616',
  'http://push.test/sqltest-push/3', 'k', 'a', null) $$, '23514', null, 'endpoint must be https');
select throws_ok($$ insert into public.push_subscriptions (space_id, profile_id, endpoint, p256dh, auth)
  values ('16161616-1616-4616-8616-161616161616', auth.uid(), 'https://push.test/sqltest-push/4', 'k', 'a') $$,
  '42501', null, 'no direct insert');

-- Read and delete own only
select tests.authenticate_as('push-b');
select is(pg_temp.rows('1'), 0::bigint, 'other member does not see the row');
delete from public.push_subscriptions where endpoint = 'https://push.test/sqltest-push/1';
select tests.authenticate_as('push-a');
select is(pg_temp.rows('1'), 1::bigint, 'other member cannot delete it');

-- Same browser, new account: the row moves to the new owner.
select tests.authenticate_as('push-b');
select lives_ok($$ select public.save_push_subscription('16161616-1616-4616-8616-161616161616',
  'https://push.test/sqltest-push/1', 'kb', 'ab', null) $$, 'new account takes the endpoint');
select is((select profile_id from public.push_subscriptions where endpoint = 'https://push.test/sqltest-push/1'),
  tests.get_supabase_uid('push-b'), 'row belongs to the new account');
delete from public.push_subscriptions where endpoint = 'https://push.test/sqltest-push/1';
select is(pg_temp.rows('1'), 0::bigint, 'owner deletes own row');

-- Outsiders
select tests.authenticate_as('push-stranger');
select throws_ok($$ select public.save_push_subscription('16161616-1616-4616-8616-161616161616',
  'https://push.test/sqltest-push/5', 'k', 'a', null) $$, '42501', null, 'stranger cannot save');
select tests.clear_authentication();
select throws_ok($$ select public.save_push_subscription('16161616-1616-4616-8616-161616161616',
  'https://push.test/sqltest-push/6', 'k', 'a', null) $$, '42501', null, 'anon cannot call');

select * from finish(true);
rollback;
