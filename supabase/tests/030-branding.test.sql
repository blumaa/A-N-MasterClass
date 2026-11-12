-- space_branding: public read, branding.manage write, colour shape guard.
begin;
select plan(8);

do $$
declare
  sp uuid := '11111111-1111-4111-8111-111111111111';
begin
  perform tests.create_supabase_user('owner');
  perform tests.create_supabase_user('assistant');
  insert into public.spaces (id, slug, name, status) values (sp, 'alexander', 'Alexander', 'live');
  insert into public.space_members values
    (sp, tests.get_supabase_uid('owner'), 'owner', now()),
    (sp, tests.get_supabase_uid('assistant'), 'assistant', now());
end $$;

select ok(public.is_brand_colors('{"accent":"#1f4fbf","accent-soft":"#dfe7f7","page":"#f6f1e7","card":"#fdfaf1","hairline":"#e4dccb","mid":"#8a8273","ink":"#1c1a17"}'),
  'full hex set is valid');
select ok(not public.is_brand_colors('{"accent":"red;}"}'), 'partial / non-hex set refused');

select tests.authenticate_as('owner');
select lives_ok($$ insert into public.space_branding (space_id, font_heading)
  values ('11111111-1111-4111-8111-111111111111', 'lora') $$, 'owner saves branding');
select throws_ok($$ update public.space_branding set font_body = 'comic-sans' $$, '23514', null, 'unknown font refused');
select throws_ok($$ update public.space_branding set colors = '{"ink":"#000"}' $$, '23514', null, 'bad colours refused');

select tests.authenticate_as('assistant');
select lives_ok($$ update public.space_branding set font_heading = 'inter' $$, 'assistant update runs');
select tests.authenticate_as('owner');
select results_eq($$ select font_heading from public.space_branding
  where space_id = '11111111-1111-4111-8111-111111111111' $$, $$ values ('lora') $$,
  'assistant update touched no row (RLS)');

select tests.clear_authentication();
select isnt_empty($$ select 1 from public.space_branding $$, 'anon reads branding');

select * from finish(true);
rollback;
