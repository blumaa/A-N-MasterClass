-- Studio adds a part first and fills it after (Kajabi block flow): a new video part has no
-- vimeo_id yet, a new download part no file_path. The player skips empty parts.
-- These checks blocked that flow, so they go.
alter table public.parts drop constraint parts_video_has_id;
alter table public.parts drop constraint parts_download_has_file;
