-- Product covers: path must be one object directly in the space's site folder.
begin;
select plan(4);

insert into public.spaces (id, slug, name, status)
  values ('24000000-0000-4000-8000-000000000001', 'cover-space', 'Cover space', 'live');
insert into public.products (id, space_id, kind, slug, title)
  values ('24a00000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'program', 'cover-prog', 'Cover program');

select lives_ok($$ update public.products set cover_path = '24000000-0000-4000-8000-000000000001/site/a-cover.jpg'
  where id = '24a00000-0000-4000-8000-000000000001' $$, 'cover in the space site folder accepted');
select lives_ok($$ update public.products set cover_path = null
  where id = '24a00000-0000-4000-8000-000000000001' $$, 'cover cleared');
select throws_ok($$ update public.products set cover_path = '24000000-0000-4000-8000-000000000002/site/a.jpg'
  where id = '24a00000-0000-4000-8000-000000000001' $$, '23514', null, 'cover from another space refused');
select throws_ok($$ update public.products set cover_path = '24000000-0000-4000-8000-000000000001/site/x/a.jpg'
  where id = '24a00000-0000-4000-8000-000000000001' $$, '23514', null, 'cover in a subfolder refused');

select * from finish(true);
rollback;
