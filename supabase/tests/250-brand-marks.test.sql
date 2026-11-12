-- Brand marks: logo and favicon must be one object directly in the space's site folder.
begin;
select plan(5);

insert into public.spaces (id, slug, name, status)
  values ('25000000-0000-4000-8000-000000000001', 'marks-space', 'Marks space', 'live');
insert into public.space_branding (space_id) values ('25000000-0000-4000-8000-000000000001');

select lives_ok($$ update public.space_branding set
  logo_path = '25000000-0000-4000-8000-000000000001/site/a-logo.png',
  favicon_path = '25000000-0000-4000-8000-000000000001/site/b-icon.png'
  where space_id = '25000000-0000-4000-8000-000000000001' $$, 'marks in the space site folder accepted');
select lives_ok($$ update public.space_branding set logo_path = null, favicon_path = null
  where space_id = '25000000-0000-4000-8000-000000000001' $$, 'marks cleared');
select throws_ok($$ update public.space_branding set logo_path = '25000000-0000-4000-8000-000000000002/site/a.png'
  where space_id = '25000000-0000-4000-8000-000000000001' $$, '23514', null, 'logo from another space refused');
select throws_ok($$ update public.space_branding set favicon_path = '25000000-0000-4000-8000-000000000002/site/a.png'
  where space_id = '25000000-0000-4000-8000-000000000001' $$, '23514', null, 'favicon from another space refused');
select throws_ok($$ update public.space_branding set logo_path = '25000000-0000-4000-8000-000000000001/site/x/a.png'
  where space_id = '25000000-0000-4000-8000-000000000001' $$, '23514', null, 'logo in a subfolder refused');

select * from finish(true);
rollback;
