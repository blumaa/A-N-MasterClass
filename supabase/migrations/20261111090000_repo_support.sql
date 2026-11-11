-- Repo adapter support. Additive.
-- 1. Every program product gets its programs row (modules reference programs.product_id), like
--    products_default_group does for communities.
-- 2. move_row: atomic swap with the adjacent sibling (repo.move). Security invoker: RLS write
--    policies of the target table apply.

create function public.products_program_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'program' then
    insert into public.programs (product_id) values (new.id) on conflict (product_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger products_program_row after insert on public.products
  for each row execute function public.products_program_row();

insert into public.programs (product_id)
select p.id from public.products p where p.kind = 'program'
on conflict (product_id) do nothing;

-- Sibling scope per table: modules by program, steps by module, parts by step, channels by community.
-- No sibling in that direction = no-op. Unknown row (or hidden by RLS) = no-op.
create function public.move_row(target_table text, target_id uuid, direction text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  scope_col text;
  scope_id uuid;
  my_pos integer;
  other_id uuid;
  other_pos integer;
begin
  scope_col := case target_table
    when 'modules' then 'program_id'
    when 'steps' then 'module_id'
    when 'parts' then 'step_id'
    when 'channels' then 'community_id'
  end;
  if scope_col is null then
    raise exception 'move_row: unknown table %', target_table using errcode = '22023';
  end if;
  if direction not in ('up', 'down') then
    raise exception 'move_row: direction must be up or down' using errcode = '22023';
  end if;

  execute format('select %I, position from public.%I where id = $1 for update', scope_col, target_table)
    into scope_id, my_pos using target_id;
  if scope_id is null then
    return;
  end if;

  execute format(
    'select id, position from public.%I where %I = $1 and id <> $2 and %s order by position %s, id limit 1 for update',
    target_table, scope_col,
    case direction when 'up' then 'position <= $3' else 'position >= $3' end,
    case direction when 'up' then 'desc' else 'asc' end
  ) into other_id, other_pos using scope_id, target_id, my_pos;
  if other_id is null then
    return;
  end if;
  -- Equal positions (legacy rows): nudge so the swap still changes the order.
  if other_pos = my_pos then
    other_pos := case direction when 'up' then my_pos - 1 else my_pos + 1 end;
  end if;

  execute format('update public.%I set position = $1 where id = $2', target_table) using other_pos, target_id;
  execute format('update public.%I set position = $1 where id = $2', target_table) using my_pos, other_id;
end;
$$;
revoke execute on function public.move_row(text, uuid, text) from public, anon;
grant execute on function public.move_row(text, uuid, text) to authenticated, service_role;
