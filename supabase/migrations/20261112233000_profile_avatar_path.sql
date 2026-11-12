-- Member avatar: one object in the member's own avatar folder of the public `site` bucket
-- (<space>/avatars/<profile>/<name>), same rule as isAvatarPath in src/lib/storage/siteImages.ts.
alter table public.space_profiles add constraint space_profiles_avatar_path
  check (avatar_path is null or avatar_path ~ ('^' || space_id::text || '/avatars/' || profile_id::text || '/[^/]+$'));
-- Bio and display name lengths match the profile form (src/features/account).
alter table public.space_profiles add constraint space_profiles_bio_length
  check (bio is null or length(bio) <= 1000);
alter table public.space_profiles add constraint space_profiles_display_name_length
  check (length(display_name) <= 80);
