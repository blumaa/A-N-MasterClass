-- Group 2 push: per-type push settings. A row = this member turned push off for this type on this
-- space. No row = push on (Kajabi: all notifications on by default). Only push is gated; the
-- in-app notification always lands. Type list mirrors NOTIFICATION_TYPES (sqlMirror.test.ts).
-- Rows go with the space profile (erase, space delete) through the foreign key.

create table public.push_mutes (
  space_id uuid not null,
  profile_id uuid not null,
  type text not null
    constraint push_mutes_type check (type in ('comment', 'reply', 'step_comment', 'mention', 'reaction', 'report')),
  created_at timestamptz not null default now(),
  primary key (space_id, profile_id, type),
  foreign key (space_id, profile_id) references public.space_profiles (space_id, profile_id) on delete cascade
);

alter table public.push_mutes enable row level security;

-- Own rows only, on a space the caller has a profile on. The sender reads with the service role.
create policy push_mutes_read on public.push_mutes for select
  using (profile_id = auth.uid());
create policy push_mutes_insert on public.push_mutes for insert
  with check (profile_id = auth.uid() and public.has_space_profile(space_id, auth.uid()));
create policy push_mutes_delete on public.push_mutes for delete
  using (profile_id = auth.uid());

revoke all on public.push_mutes from anon, authenticated;
grant select, insert, delete on public.push_mutes to authenticated;
