-- Platform admin sets up a new space's owner (G1): the owner's space profile is created by the
-- admin, not by the owner, so the insert policy also allows the platform admin.
drop policy space_profiles_insert on public.space_profiles;
create policy space_profiles_insert on public.space_profiles for insert
  with check ((profile_id = auth.uid() and public.is_space_participant(space_id)) or public.is_platform_admin());
