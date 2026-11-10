-- Site: drafts stay with editors, visitors read published_pages, shape + uniqueness guards.
begin;
select plan(14);

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  n uuid := '22222222-2222-4222-8222-222222222222';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('assistant');
  perform tests.create_supabase_user('other_owner');
  perform tests.create_supabase_user('student');
  insert into public.spaces (id, slug, name, status) values (a, 'alexander', 'Alexander', 'live'), (n, 'natasha', 'Natasha', 'live');
  insert into public.space_members values
    (a, tests.get_supabase_uid('owner'), 'owner', now()),
    (a, tests.get_supabase_uid('assistant'), 'assistant', now()),
    (n, tests.get_supabase_uid('other_owner'), 'owner', now());
  insert into public.pages (id, space_id, slug, title, is_home, draft, published, published_at) values
    ('33333333-3333-4333-8333-333333333333', a, 'home', 'Home', true,
     '[{"id":"s1","kind":"hero","hidden":false,"fields":{"heading":"New draft"},"items":[]}]',
     '[{"id":"s1","kind":"hero","hidden":false,"fields":{"heading":"Live"},"items":[]}]', now());
  insert into public.pages (space_id, slug, title) values (a, 'about', 'About');
end $$;

select ok(public.is_site_sections('[]'), 'empty section list is valid');
select ok(not public.is_site_sections('[{"id":"x","kind":"script","hidden":false,"fields":{},"items":[]}]'), 'unknown section kind refused');
select ok(not public.is_nav_items('[{"label":"x","href":"javascript:alert(1)"}]'), 'javascript: link refused');
select ok(not public.is_nav_items('[{"label":"x","href":"//evil.example"}]'), 'protocol-relative link refused');

select tests.authenticate_as('assistant');
select lives_ok($$ insert into public.pages (space_id, slug, title)
  values ('11111111-1111-4111-8111-111111111111', 'contact', 'Contact') $$, 'assistant (site.edit) creates page');
select throws_ok($$ insert into public.pages (space_id, slug, title, is_home)
  values ('11111111-1111-4111-8111-111111111111', 'home-2', 'Home 2', true) $$, '23505', null, 'one home page per space');
select throws_ok($$ insert into public.pages (space_id, slug, title)
  values ('11111111-1111-4111-8111-111111111111', 'about', 'About again') $$, '23505', null, 'slug unique per space + kind');
select lives_ok($$ insert into public.pages (space_id, kind, slug, title)
  values ('11111111-1111-4111-8111-111111111111', 'post', 'about', 'About the blog') $$, 'same slug allowed as a post');
select throws_ok($$ insert into public.pages (space_id, kind, slug, title, is_home)
  values ('11111111-1111-4111-8111-111111111111', 'post', 'hello', 'Hello', true) $$, '23514', null, 'post cannot be home');

select tests.authenticate_as('other_owner');
select is_empty($$ select 1 from public.pages $$, 'other space owner sees no pages');

select tests.authenticate_as('student');
select is_empty($$ select 1 from public.pages $$, 'student cannot read the pages table (drafts)');

select tests.clear_authentication();
select results_eq($$ select slug, published -> 0 -> 'fields' ->> 'heading' from public.published_pages $$,
  $$ values ('home', 'Live') $$, 'anon reads only published pages, published sections');
select throws_ok($$ select draft from public.published_pages $$, '42703', null, 'published_pages has no draft column');
select is_empty($$ select 1 from public.page_versions $$, 'anon sees no versions');

select * from finish(true);
rollback;
