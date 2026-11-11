-- Post and comment length limits move into the database, like messages and challenge entries.
-- They lived only in the repos, so a direct PostgREST write could store any length.
-- Numbers = POST_MAX / COMMENT_MAX in src/lib/data/limits.ts.
alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_body_check
  check (length(trim(body)) > 0 and length(body) <= 10000);
alter table public.comments drop constraint comments_body_check;
alter table public.comments add constraint comments_body_check
  check (length(trim(body)) > 0 and length(body) <= 5000);
