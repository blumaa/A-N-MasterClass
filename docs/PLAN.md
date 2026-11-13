# Masterclass platform — plan (working name `masterclass`)

## Context

Alexander + Natasha want Kajabi-like platform: each runs own branded site selling masterclass/seminar programs, communities, coaching, podcasts, downloads. Teaching via Vimeo. KSG (`kinbaku-study-group/`) = reference for MDS usage, Vimeo embed, circles feed/comments/reactions, deterministic writes, gates. New app, new repo, not fork. Rule G0: mimic Kajabi behaviour unless Decisions table says otherwise.

Decided with user:
- One platform, multi-tenant. Tenant = **space** (one per instructor). Closed group (G1).
- Custom domain per instructor; default `<slug>.<platform>` (G17).
- Products per space: program, community, coaching, podcast, download (G13, G18). Offers sell any mix.
- Program > module > step (lesson, ticked once) > parts (content blocks) (G6).
- Editable public site + sales pages + blog (SEO) → **Next.js App Router** (G11).
- PayPal first, each instructor's own PayPal Business account via own REST app; one-time payments v1 (G3, G5, G28).
- No marketing suite; external tool + webhooks (G16). PWA, no store apps (G20).
- English only (i18n scaffold, one locale).

## Stack

| Layer | Choice |
|---|---|
| App | Next.js App Router, React 19, TS strict. Server Components for public pages; client components for app/admin |
| Server state (client) | TanStack Query, KSG settings. Deterministic writes, no `onMutate` (KSG D8) |
| Backend | Supabase: Postgres + Auth + RLS + Storage. **Pro plan** (no pause, backups) |
| Video | Vimeo embed by id, KSG way (D51). oEmbed meta, poster copied to bucket |
| UI | `@mond-design-system/react` + `/tokens`, CSS Modules for arrangement. No Tailwind |
| Rich text | TipTap 3 (KSG `editor/extensions.ts` pattern) |
| Email | transactional provider TBD (Resend/Postmark) via route handler |
| Hosting | Vercel, custom domains per space |
| Tests | Vitest + RTL, Playwright e2e, pgTAP-style SQL RLS suites (KSG `test:sql`) |
| Process | TDD. Same gates as KSG; `docs/PLAN.md` decisions log |

## Repo

New sibling dir `Alexander Ma  + Natasha Umbrella/masterclass/`. Single Next app + `supabase/`. pnpm.

```
src/app/                 routes only (App Router)
  (platform)/            platform host: super-admin, space creation
  [space]/(public)/      sales pages, program landing, checkout return  — SSR/ISR
  [space]/(learn)/       student: dashboard, program player, community
  [space]/(studio)/      instructor admin ("Studio")
  api/                   route handlers: payments webhook, vimeo meta, revalidate
src/features/<name>/{api,components,index.ts}   programs · player · progress · community ·
                         pages · offers · checkout · students · branding · analytics · auth
src/components/          product-aware shared UI (engagement/, VimeoEmbed, ...)
src/lib/                 supabase (server/browser clients), domain guards, theme, vimeo, storage
proxy.ts (middleware)    host → space resolution
supabase/{migrations,tests,functions}
scripts/                 gates (copied)
```

ESLint boundary rules copied from KSG `eslint.config.mjs:78-123` (feature ↛ feature, shared ↛ feature).

## Tenancy + domains

- `spaces(id, slug, name, status)`, `space_domains(host, space_id, primary)`.
- Middleware reads `Host`, looks up `space_domains` (edge-cached), rewrites to `/[space]/…`. Platform host → `(platform)`. Dev: `alexander.localhost`, `natasha.localhost`.
- v1 domains added by hand in Vercel + table row (two tenants). Vercel Domains API automation = later.
- Auth cookies are per domain → student logs in per space. Same `auth.users` row may enroll in both spaces.
- Each domain into Supabase Auth redirect allow-list + Vimeo embed domain allow-list + CSP.

## Roles

- `platform_admin` flag on profile (you).
- `space_members(space_id, profile_id, role: owner | admin | assistant | support)` — staff. Capability matrix SSOT (G15). `space_member_communities` limits staff per community. `channel_moderators` for students.
- Customers = `grants(product_id, profile_id, access_group_id null, source: purchase | manual | free, status, granted_at, expires_at)` — one table for every product kind (replaces program-only `enrollments`).
- RLS helpers: `has_capability(space_id, cap)`, `has_grant(product_id)`, `can_read_step(step_id)` (grant + module lock G7 + drip G8), `can_read_channel(channel_id)`. Pattern = KSG `can_read_post`.

## Content model

```
products(id, space_id, kind program|community|coaching|podcast|download, slug, title, subtitle,
         cover_path, status draft|published, theme_override jsonb, position)
programs(product_id pk, community_product_id null)          -- linked community tab (G13)
modules(id, program_id, title, description, position, status,
        unlock_after_step_id null, release_after_days null, release_at null)   -- G7, G8
steps(id, module_id, title, description, position, status)
parts(id, step_id, kind video|text|download|image|embed, title, position, body jsonb,
      vimeo_id, aspect, duration_s, poster_path, file_path, file_size)
step_progress(profile_id, step_id, completed_at)
video_position(profile_id, part_id, last_position_s)
```

- Completion per **step**, "Complete & Continue" button, un-tick allowed, no web auto-complete (G6, G7). Program/module % = rollup RPC `program_progress(program_id)` over published steps. Checkmarks + MDS `ProgressBar` at program + module.
- Locked module / drip: sidebar shows lock or "Opens in N days"; enforced in `can_read_step`.
- "Resume" = latest `step_progress` / `video_position`.
- Video: Vimeo Player SDK `timeupdate` → save `video_position` (throttled). Port `lib/vimeo.ts`, `VimeoEmbed`, `vimeo-poster` function from KSG. Each instructor's own Vimeo account (G9).
- Other product kinds: coaching (`coaching_programs`, `availability_rules`, `availability_overrides`, `sessions` with exclusion constraint, `calendar_connections`) (G19); podcast (`episodes`, private per-buyer feed token); download (`product_files`, signed URLs).
- Downloads: private bucket `resources`, signed URLs, TTL constant (KSG `lib/storage.ts`, `check:signing`).
- Reorder via `reorder_*` RPCs (KSG `featured_reorder` + `reorder.ts`/`rank.ts`).

## Branding (runtime, per space, per-program override)

- `space_branding(space_id, colors jsonb (7 brand inputs), logo_path, favicon_path, font_heading, font_body)`.
- Theme = MDS brand-alias file approach (KSG `tokens/brand-kinbaku.css`): 7 inputs → `color-mix` ramps → 56 `--mds-*` aliases.
- Root cause noted by exploration: aliases declared on `:root` resolve there; wrapper override does nothing. Fix: server layout renders `<style>` setting the 7 inputs on `:root` per request (SSR → no flash, portals/sheets/toasts covered). Static brand-alias CSS stays a file, only inputs vary. Program override = same, scoped to program route layout.
- Brand editor validates contrast against MDS `contrast-contract.json`; refuses failing combos. Live preview pane.
- Fonts: curated list (`next/font` / Google), not free text.

## Sales pages

- `pages(id, space_id, program_id null, slug, title, seo jsonb, sections jsonb, status, published_at)` + `page_versions` (publish snapshots, restore).
- Section-based builder, not free canvas: hero, rich text, video, curriculum (auto from program tree), instructor bio, testimonials, FAQ, offer/pricing cards, CTA, image+text. Each section = typed block + type guard + server renderer + editor form.
- Public render = Server Components, ISR, `revalidateTag` on publish. Metadata API for SEO/OG.
- Space home page = a `pages` row flagged home.

## Commerce (provider-agnostic)

- `offers(id, space_id, title, price_cents, currency, kind one_time | subscription | payment_plan, status, access_days null)` — v1 one_time only (G5). `offer_products(offer_id, product_id, access_group_id null)`. `orders(id, offer_id, profile_id, provider, provider_ref, status, amount, livemode)` (G10).
- `PaymentProvider` interface: `createCheckout(offer, buyer)`, `verifyWebhook(req)`, `toOrderEvent(event)`. Adapters: `paypal` (G28), `manual`, `free`; `stripe` later behind same interface. Route handler `api/payments/[provider]/webhook` → idempotent `fulfil_order` RPC → `grants`.
- PayPal flow: branded checkout page renders PayPal JS SDK buttons (PayPal, Pay Later, guest card) with space's client ID → server route creates order (Orders v2, server-side price from `offers`, never client) → buyer approves → server route captures → `fulfil_order`. Webhook `PAYMENT.CAPTURE.COMPLETED` = backup path, same idempotent RPC (key = capture id). Signature checked via PayPal verify-webhook-signature with space's `webhook_id`.
- `payment_credentials(space_id, provider, env sandbox | live, client_id, secret → Vault, webhook_id)`. Owner capability only (G15).
- Checkout flow per G4: guest checkout, known email added, success page auto-login → set password, 10-day `claim_tokens` link in receipt email.
- `contacts` + consent, CSV export, signed outbound webhooks (G16).

## Community (Kajabi Communities, KSG port as base) — G12, G13, G14

- Community = product. `channels(id, community_id, kind feed | chat, visibility public | private | read_only, title, position)`, `channel_members` for private. `access_groups(id, community_id, title, features jsonb)` toggles challenges / events / leaderboard / directory / DMs per tier. `community_labels` jsonb for renameable features.
- Feed channels: `posts(channel_id, ...)`, KSG posts minus `post_destinations`/library/tags.
- Chat channels + DMs: `messages(channel_id | dm_thread_id, ...)`, Supabase Realtime (invalidate-only rule kept, `check:realtime`).
- Gamification: `points_ledger(profile_id, community_id, reason, points, created_at)` (append-only; Kajabi point rules verified in docs), leaderboard views 7d / 30d / all-time; `challenges` + check-ins.
- Meetups/events: `events(community_id, starts_at, ends_at, tz, join_url, replay_vimeo_id)`, RSVP, `.ics`, reminder (G14).
- Member directory from `space_profiles` (G2), access-group gated.
- Port near as-is (exploration map): `components/engagement/*` (ReactionBar, picker, ReactorsSheet, CommentThread, comments hooks, `thread.ts`), `lib/mentions/*`, `useDeterministicWrite`, `lib/feedback.ts`, `lib/confirm.tsx`, photo pipeline (`lib/photo.ts`, `resize.ts`, `upload.ts`), emoji migration + `scripts/gen-emoji.ts`, reaction/comment/mention SQL (squash final versions), `NotificationChannel`, push (`lib/push/*`, `push-sw.js`, `PushHeal`).
- Change vs KSG: **comments polymorphic from day one** (`target_type post | step`) → lesson comments like Kajabi. Moderation via `has_capability` + `channel_moderators` instead of `is_admin()` (G15). Notification types redefined (`channel_post`, `step_comment`, `reply`, `mention`, `reaction`, `dm`, `event_reminder`, `granted`).

Phase 6 as built (Launch 1):
- Migration `20261110090600_community.sql` + `supabase/tests/060-community.test.sql` written, applied to ksb 2026-11-11.
- New community starts with a `General` channel. Deleting the last channel is refused in the app, not by trigger (a trigger would block the cascade when the community is deleted).
- Notifications: comment notifies post author + mentioned; reply notifies parent author; step comment notifies everyone with `comments.moderate`; first reaction notifies author. Only directory members of the community receive. Mentions in step comments are not notified, and step comments have no mention autocomplete.
- One reply level (Kajabi). Polymorphic targets have no FK; delete triggers on posts/steps/comments remove orphans.
- `ALWAYS_REACH` (owner, admin) lives in `lib/auth/capabilities.ts`, mirrored by `reaches_community()`.
- Push notifications: Launch 6 item 6. Chat/DMs/access groups = Launch 2. Channel moderators + reports = Launch 6 item 3.

## Studio (instructor admin)

Sidebar: Dashboard · Products (Programs, Communities, Coaching, Podcasts, Downloads) · Site (Pages, Blog, Nav/Footer) · Offers · Customers · Branding · Settings · Analytics. Each item gated by capability (G15).
- **Programs**: curriculum tree editor — add/rename/reorder/publish modules, steps, parts; module lock + drip fields; part editor per kind (Vimeo link field from KSG `VimeoLinkField`, TipTap text, file upload); preview-as-student.
- **Communities**: channels, access groups, labels, challenges, events, moderation queue (KSG reports pattern).
- **Coaching**: availability, Google Calendar connect, sessions list, notes.
- **Site**: pages → sections → blocks builder, live preview, draft/publish, versions; blog posts; nav + footer (G11).
- **Offers**: CRUD, link products/access groups, checkout link.
- **Customers**: DataTable (KSG `features/admin/Members.tsx` model) — grants, progress %, last active, grant/revoke, invite, CSV export.
- **Branding / Settings**: colors, logo, fonts, PayPal credentials + setup checklist (sandbox + live), Vimeo checklist (G9), webhooks (G16), staff + roles, domain (read-only v1).
- **Analytics**: revenue (livemode only), grants, completion per module, page views (KSG `admin_stats_*` pattern).

## Student side

Space library (my products + progress) → program page (module list, checkmarks, locks, progress bar, "Continue") → step page (parts, Vimeo, downloads, "Complete & Continue", prev/next, step comments) → community (channels, chat, DMs, events, leaderboard, directory) → coaching (book, upcoming sessions) → podcast feed link → downloads. PWA install + push (G20).

## Launches (each = PRs, TDD, `pnpm verify` green) — G22

**Launch 1 — sell a program with its community**
0. Foundation — repo, Next, MDS + static brand file, gates copied (`check-size`, `deterministic`, `realtime`, `signing`, `errors`, `tokens` adapted, `scripts/lib/gate.mjs`), ESLint boundaries, CI (`db reset`), Supabase linked (G21), auth, host→space middleware, platform constant (G17), transactional email + sender domains.
1. Schema + RLS — spaces, profiles, roles + capability matrix, products, grants, program tree, progress; SQL RLS suites first.
2. Programs — Studio curriculum builder, step page, Complete & Continue, locks, drip, downloads, Vimeo.
3. Branding — editor, runtime `:root` theme, contrast check, per-product override, per-space PWA manifest.
4. Site — page builder, sales pages, blog, nav/footer, SSR/ISR, SEO, versions.
5. Commerce — offers, PayPal per-space credentials, checkout page with PayPal JS SDK, server create/capture, webhook → grants, claim flow, receipts, contacts + webhooks + CSV.
6. Community core — community product, feed channels (KSG port), polymorphic comments, reactions, mentions, notifications, push, moderation, directory.
7. Domains go live — real domains in Vercel, Auth allow-list, Vimeo allow-list, CSP.

Phase 7 as built (Launch 1):
- Custom hosts resolve through `space_domains` (`routeHost` + `createHostLookup`, 60 s in-process cache, misses cached, failures not). Unknown host = 404.
- Domains are added by hand: Vercel dashboard + `space_domains` row. Checklist: `docs/DOMAINS.md`. Vercel Domains API = later.
- CSP is a static header from `next.config.ts` (`src/lib/security/csp.ts`), no nonce: a nonce forces dynamic rendering of every page and disables ISR. `'unsafe-inline'` for scripts/styles, as PayPal recommends.
- Blocked on the real platform domain (G17) to actually go live.

**Launch 2** — chat channels, DMs, access groups.

Launch 2 as built:
- Migration `20261110090700_community_groups_chat_dms.sql` + `supabase/tests/070-groups-chat-dms.test.sql` written, applied to ksb 2026-11-11. `channels.visibility` replaced by `kind` (feed | chat), `privacy` (public | private) and `read_only`.
- Every community gets a default `Members` group (trigger). A grant or offer item without a group joins it. The default group cannot be deleted; a group in use cannot be deleted (FK restrict).
- Grant uniqueness widened to one active grant per (product, profile, group): a member may hold several groups of one community. `fulfil_order` now carries `offer_products.access_group_id`; drip counts from the earliest grant.
- Channel read: staff, or member whose groups include the channel's group, and (public or invited via `channel_members`). Directory + DM-start toggles = union over the member's groups.
- DMs: reply needs DMs on, both members, no block either way. Start also needs a group with DMs (staff always); members reach the owner only while `founder_dms` is on. Only the author deletes a DM; channel lines also by post moderators.
- Live updates: polling at first; Supabase Realtime since Launch 6 item 5 (see there), structure and membership since Group 2 live updates. Typing indicators: Launch 6 item 7.

**Launch 3** — challenges, points, leaderboard, meetups/events.

Launch 3 as built:
- Migration `20261110090800_community_gamification_meetups.sql` + `supabase/tests/080-gamification-meetups.test.sql` written, applied to ksb 2026-11-11.
- Points: comment on a post 3, reaction given 1 / received 1 (once per member per post, never on own post), DM 1, challenge entry 100. Values editable 0..1000 per community, 0 = off for that action; fixed when earned. Ledger written by triggers only, rows removed with their source, so totals never go negative.
- Leaderboard: 7 days / 30 days / all time; the week resets Monday 08:00 UTC, the month on the 1st 08:00 UTC. Shown to members, staff only, or off; members also need a group with the leaderboard on.
- Challenges: window in UTC, one entry per member inside the window, withdraw while open. Entries visible to the author and staff only; staff export CSV. Upcoming challenges hidden unless "show before start".
- Meetups: times shown in the event's zone (member's zone since Launch 6 item 9 follow-up). Join link hidden from clients (column privilege), read via `meetup_join_url()`: staff always, members from 15 minutes before the start until the end. RSVP until the end. `.ics` links to the meetup page, not the join link. Replay = Vimeo id, shown after the end.
- Studio: points settings on the community page; challenges + meetups on `studio/communities/[id]/events`. Group toggles: challenges, meetups, leaderboard.
- Not yet: meetup reminder emails (email provider pending).

**Launch 4** — coaching + own scheduler + Google Calendar.

Launch 4 as built:
- Migration `20261110090900_coaching.sql` + `supabase/tests/090-coaching.test.sql` written, applied to ksb 2026-11-11.
- Coaching product = program settings: 1:1 (clients book) or group (coach schedules), 15..360 min, sessions included per grant, default https join link copied onto new sessions.
- One schedule per space: IANA zone, buffers before/after, minimum notice, window 1..200 days, cancel cutoff. Weekly windows + date overrides (window or day off) in the coach's zone. Kajabi default hours (weekdays 9 to 5) until the coach saves settings or adds a window.
- Slots: 15-minute grid in the coach's zone (DST-safe), minus scheduled sessions + buffers + Google free/busy. Calendar unreachable = no slots and booking refused (fail closed). The session being moved does not block its own time.
- DB: exclusion constraint (btree_gist) on space + time range for scheduled sessions; client booking via `book_coaching_session` (locks the program row, checks grant, balance, length); client changes via `change_coaching_session` (own session, before the cutoff). Notes staff only.
- Google Calendar: OAuth (offline; scopes `openid`, `email`, `calendar.freebusy`, `calendar.events.owned`, SSOT `GOOGLE_SCOPES` in `src/lib/google/calendar.ts`), state cookie checked on callback, refresh token in Vault (`save_calendar_connection`, service role only, removed with the connection). DB row is the truth: sync after the write; failure = "Not synced" in Studio with "Sync again". `invalid_grant` = calendar down until reconnected.
- Client: library tile, coaching page (balance, slots in the client's zone since Launch 6 item 9, agenda), session page (join link, `.ics`, reschedule/cancel until cutoff). Studio: Coaching nav (products.edit), group sessions, program settings, hours, overrides, calendar (settings.manage), session page with notes, reschedule, cancel.
- Not yet: confirmation/reminder emails (email provider pending), Google app verification (testing mode refresh tokens expire after 7 days).

Launch 5 as built:
- Migration `20261110091000_podcasts_downloads.sql` + `supabase/tests/100-podcasts-downloads.test.sql` written, applied to ksb 2026-11-11.
- Podcast = settings (author, explicit, episodic/serial) + episodes (mp3 only, 1 byte..250 MB, season, type full/bonus/trailer, show notes, publish_at null = draft, future = scheduled). Holders see published episodes only; staff see all.
- Private feed per listener: token from `podcast_feed_token` (created on first ask), `reset_podcast_feed` replaces it. Feed + audio routes under `/feeds/podcast/[token]` take no session; `podcast_feed` (service role only) answers only while the listener's grant is active.
- Download = list of files; holders read the list. Every file and audio request goes through a server route that returns a 302 to a short signed URL (`signedRedirect`, `cache-control: no-store`).
- Files in private bucket `resources` (no object policies = service role only). Bucket limit 250 MB; Supabase Free caps uploads at 50 MB, Pro allows up to 500 GB (https://supabase.com/docs/guides/storage/uploads/file-limits).
- Client: Podcasts + Downloads tiles in the library, podcast page (episodes, feed URL, reset), downloads page. Studio: Podcasts + Downloads nav (products.edit).

**Launch 5** — podcast + download products.
**Launch 6 — finish the deferred gaps** (no outside service needed; decided 2026-11-12). External setup (email provider, PayPal app, platform domain, paid plans) waits until this is done. Order:
1. Supabase file store adapter (`getFileStore`) + Studio upload UI for download files and podcast audio.
2. Download parts in program steps through the signed route.
3. Moderation: `channel_moderators` + reports queue.
4. Photo uploads in posts; attachments in chat.
5. Supabase Realtime in place of polling (invalidate only).
6. Web push notifications (VAPID, KSG stack).
7. Typing indicators in chat.
8. Recurring meetups.
9. Coaching slots in the client's own time zone.
10. "Download all" (one download per file, no zip).
11. Quizzes (`parts.kind = quiz`, `quiz_passed` unlock) + certificates (G26).
12. Coupons, order bumps, upsells (G23).
13. Subscriptions + payment plans (G5), built against the PayPal fake.

Launch 6 item 1 as built:
- `createSupabaseFileStore` (service role): `signedUrl`, `uploadUrl` (`createSignedUploadUrl`, valid 2 h), `remove`. Contract test against ksb (`fileStore.contract.test.ts`).
- Upload flow: Studio `FileUpload` field asks `requestUploadAction` for a ticket, then PUTs the bytes straight to Storage (XHR for progress, same request as supabase-js `uploadToSignedUrl`, no upsert), then fills hidden path + size inputs. The picker has no name, so bytes never go through the Server Action.
- Ticket checks: products.edit, product in the viewer's space (Host), right kind, size 1 byte..250 MB, podcast = .mp3.
- Object key `<spaceId>/<productId>/<uuid>-<safe name>` (`uploadPath`). `addFile`, `createEpisode`, `updateEpisode` refuse any path outside that folder (not_found). An unchanged legacy episode path still saves.
- Delete file, delete episode or replace episode audio: the old object goes through `storage_trash` (Group 2 cleanup).
- CSP: `media-src` now allows the Supabase origin (episode `<audio>` follows the 302). Upload XHR is covered by `connect-src`.
- Fake repos (media, coaching) now replace rows on update instead of mutating them, like the Supabase repo. Other fake repos still mutate rows in place.
- Not yet: size is what the browser reports, not read back from Storage; uploads do nothing with `DATA_SOURCE=fake` (fake upload URL points nowhere). Supabase Free caps one upload at 50 MB; the bucket allows 250 MB on Pro.

Launch 6 item 2 as built:
- Studio download part: `FileUpload` (upload kind `program`, same checks: products.edit, product in Host space, right kind, 1 byte..250 MB). Form saves `filePath` + `fileSize`; blank path clears both.
- `updatePart` refuses a path outside `<spaceId>/<programId>/` (not_found). An unchanged legacy path still saves.
- Student step page: download part shows title + type + size, links to `/programs/[program]/[step]/files/[part]`. Route reuses `stepView` (grant + module lock + drip; RLS `can_read_step` on parts again), then 302 to a signed URL named after the part title. Path never rendered.
- Delete part, step or module, or replace a part file: old objects go through `storage_trash` (Group 2 cleanup).
- `parts.file_size` now used (column existed, no migration). Fake parts replaced on update, not mutated.
- Not yet: program delete has no op (the trigger cleanup covers it once it exists); size is what the browser reports.

Launch 6 item 3 as built:
- Migration `20261112090000_moderation.sql` + `supabase/tests/130-moderation.test.sql` (23 asserts), applied to ksb 2026-11-12.
- `channel_moderators`: staff with `community.moderate` pick non-staff members per channel in Studio (private channel: invited members only). SSOT: `can_moderate_channel()` in SQL = `channelAccess().moderatePosts/moderateComments` in TS. A moderator must also read the channel.
- Channel moderator hides/deletes posts and comments, deletes chat lines, pins, in their channels only. Cannot pick moderators.
- Reports: post, comment on a post, channel chat line. Not step comments, not DMs. Any reader reports once (unique), reason optional, max 500 chars. Own content refused. Hidden content only reportable by its moderators.
- Queue: Studio `communities/[id]/reports` (staff) and `community/[slug]/reports` (nav link for anyone moderating a channel). Same `ReportQueue` view. Preview cut to 280 chars.
- Dismiss keeps content. Remove deletes it and closes every open report on it. Resolved rows stay with `resolved_by` + `resolved_at`.
- Reporter hidden: column grant drops `reporter_id`; `report_reporters(community)` RPC for staff with `community.moderate` only.
- G0 diff: Kajabi moderators are channel-scoped teammates with hide/restore/lock/approve, Review Feed, View Logs; mobile has user reports without detail. Here (G15) moderators are trusted students, reports target content, lock, approval and logs added in the follow-up below.
- Not yet: see follow-up below.

Launch 6 item 3 follow-up as built:
- Migration `20261114000000_moderation_review.sql` + `supabase/tests/280-moderation-review.test.sql` (31 asserts), applied to ksb 2026-11-12.
- Hide/restore: hidden post leaves the feed for members (author too). Review Feed "Hidden" tab lists hidden posts; moderator unhides there. Hidden comments stay inline with a badge for moderators (no tab).
- Lock/unlock: post menu (moderators). Locked post takes no new comments: `createComment` (TS `postOpen`) + comments insert RLS (`post_open`). Reactions and reports still work. Post page shows "Comments are closed."
- Post approval: Studio community page, "Post approval" picker (`post_approval_members`, per member, per community, needs `community.moderate`). Their new posts start `pending` (trigger `posts_status`). Moderator approves or rejects; rejected can be approved later. Author not notified; author sees "Waiting for approval" / "Not approved" badge.
- Visibility SSOT: SQL `can_read_post` = TS `seesPost` (moderator, or not hidden and (published or author)). Feed = `inFeed`.
- Review Feed: existing reports pages, `?tab=reports|pending|rejected|hidden|locked|log`. No new route. Studio and member side share `ReviewFeed` (`review` / `studioReview`). Channel moderators see their channels only.
- Report queue "Hide": hides the content, resolves every open report on it as `hidden`.
- Logs (`moderation_log`): hide, unhide, lock, unlock, approve, reject. Moderator, action, timestamp, content preview + link (null once deleted). Filter by action and date range (`?action=&from=&to=`, UTC days, both ends included). Read: channel moderators for their channels, comment moderators (staff) all.
- Report notifications: new type `report` to every channel moderator (`can_moderate_channel` recipients, SSOT), links to the Review Feed. Also web push since Group 2 push (`reportAction` moved to `app/[space]/reportActions.ts`, uses `pushingRepo`).
- G0 diff: no "report a user" (Kajabi mobile has it). Reports target content only.
- Not yet: member data export does not include `moderation_log` or `post_approval_members`. Erase: approval row cascades; log keeps the row, actor null ("Someone").

Launch 6 item 4 as built:
- Migrations `20261112100000_community_files.sql` + `20261112100100_messages_attachment_not_null.sql`, `supabase/tests/140-community-files.test.sql`, applied to ksb 2026-11-12.
- Private bucket `community` (25 MB, type allow-list), apart from Studio `resources`. Folders: `<space>/<community>/<channel>/` (feed photos, chat files), `<space>/<community>/dm/<thread>/` (DM files). DB triggers keep each row inside its own folder.
- Post photos: feed composer takes up to 10 (`post_photos`, trigger caps 10). Browser resizes to long edge 2048, JPEG 0.85 (copied from KSG, G27); GIFs pass through. Images only, 10 MB each. Post page: author adds photos while they may post; author or moderator removes one. Body still required.
- Chat (channels + DMs): one file per line, image or common file type, up to 25 MB, not resized. A line may be a file alone. Images inline, other files as a link with size.
- Upload ticket (`communityUploadAction`): channel needs rules.post, DM needs canReply; feed channels take photos, chat and DMs take attachments; type + size checked; path signed inside the folder. Command checks the folder again.
- Signed routes: `community/[community]/posts/[post]/photos/[photo]` and `community/[community]/attachments/[message]` re-check read access (hidden post only for its moderators, DM only for participants) and the community slug. Non-images download under their name.
- Delete post, delete chat line, remove photo, report Remove, Studio delete channel: objects go through `storage_trash` (Group 2 cleanup). `channel_files` RPC dropped.
- G0 diff: Kajabi allows 40 MB photos and video in posts; here photos are resized and posts take no video.
- Not yet: photo captions/reorder; thumbnails (full photo shown cropped in the grid); uploads do nothing with `DATA_SOURCE=fake`.

Launch 6 item 5 as built:
- Migration `20261112110000_live_topics.sql` + `supabase/tests/150-live-topics.test.sql` (28 asserts), applied to ksb 2026-11-12.
- Private broadcast, not `postgres_changes`: postgres_changes sends row data and does not apply RLS to deletes. Here statement triggers on `messages`, `posts`, `post_photos`, `comments`, `reactions` call `live_send`, which sends an empty `stale` event (`realtime.send`) to each topic once per statement.
- Topics (SSOT `src/lib/realtime/topics.ts` = `can_join_live` + `live_topics` in SQL): `channel:<id>` (chat lines, feed posts, comments, reactions, photos), `post:<id>`, `dm:<thread>`, `inbox:<profile>`.
- Join: RLS select policy `live_topics_read` on `realtime.messages`, `can_join_live(realtime.topic())` = `can_read_channel` / `can_read_post` (hidden only for moderators) / `is_dm_participant` / own inbox. No insert policy, so clients cannot send. Anonymous viewers get no topics.
- Client: `<LiveRefresh topics>` (server component, `src/components/LiveRefresh`) on channel (chat + feed), post, DM thread and inbox pages. Supabase: `RealtimeRefresh` opens the private channels (`listenStale`). Fake: `PollRefresh` every 5 s. Both feed the same scheduler: a burst gives one `router.refresh` (300 ms window), a hidden tab does nothing and refreshes once when visible again. Channels removed on unmount.
- Invalidate only: the handler gets no payload. `check:realtime` now also fails on `postgres_changes` and on a channel without `private: true`.
- For item 7: `privateChannel(host, topic, bind)` takes any listeners (broadcast, presence). Typing needs an insert policy on `realtime.messages`.
- Caveats: Realtime caches the join check per connection, so lost access keeps hints flowing until the token refreshes or the page reloads (hints are empty). `realtime.messages` is partitioned by day and the Realtime service makes the partitions while clients are connected; with no partition the send only warns (nobody is listening then). The SQL suite skips the round trip then.
- Free plan limits: 200 concurrent connections, 100 messages/s, 100 channel joins/s, 2M messages/month. Pro: 500 connections, 5M messages, then $2.50 per million.
- Closed in Group 2 live updates: nav badges, blocks, channel and membership changes are live on every community page.

Launch 6 item 6 as built:
- Migration `20261112120000_push_subscriptions.sql` + `supabase/tests/160-push-subscriptions.test.sql` (14 asserts), applied to ksb 2026-11-12.
- `push_subscriptions`: one row per browser endpoint, owned by a profile on one space. Members read and delete own rows; they save through `save_push_subscription` (needs a profile on that space; a known endpoint moves to the account that saves it last). Sending reads and deletes with the secret key.
- Push is one more delivery for in-app notifications. `pushingRepo` (app/[space]) wraps `addNotifications` for community actions: the write lands, then `after()` builds title (space name), body (`describeNotifications` text) and URL (`notificationHref`) and sends. Payload = title, body, url only.
- Targeting: only rows of the space the notification belongs to. Each space host serves its own worker (`/push-sw.js` route, source in `lib/push/serviceWorker.ts`), so each space has its own endpoint. The worker forces every URL onto its own origin, so a click opens that space's host.
- 404/410 from the push service deletes the row. Other errors go to `reportError`, never swallowed.
- Config `src/config/push.ts`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. All unset = push off (no switch, no worker). Half set throws. `DATA_SOURCE=fake` sends nothing. The public key goes to the browser as a prop, so the build needs no keys.
- UI: switch on /notifications per device (MDS `Switch`). iPhone/iPad Safari outside the home-screen app gets install steps instead (push needs iOS 16.4+ home-screen app); unsupported and blocked browsers get a note. `PushHeal` in the space layout re-subscribes when the browser or server lost the subscription.
- Shared device: space sign-out (`SignOutForm`) first deletes this browser's row and unsubscribes it (`leavePush`), then ends the session; a push failure is reported and sign-out goes on. The local hint `push-on:v2` holds the profile id that turned push on, so `PushHeal` re-subscribes only that account; for anyone else it unsubscribes a subscription the server does not keep for them (`healPlan` `drop`). Signed-out visitors: `PushHeal` unsubscribes whatever is left (`dropPush`). Leak window when sign-out cleanup failed or the session switched without sign-out (claim link, checkout, dev login): until the next space page load. The old row goes on the next 410. Platform host serves no worker, so its sign-out is unchanged.
- Closed in Group 2 push: per-type push settings, KSG's iOS tap parking, notification icon, report push. A new action that writes notifications must use `pushingRepo` too (today: `communityActions.ts`, `reportActions.ts`, both in `app/[space]`).

Launch 6 item 7 as built:
- Migration `20261112130000_typing_topics.sql` + `supabase/tests/170-typing.test.sql` (20 asserts), applied to ksb 2026-11-12.
- Broadcast, not presence: presence would also show who is online. Own topics `typing-channel:<id>` and `typing-dm:<thread>`, so clients never send on the data topics (those stay database-only `stale` hints).
- Receive: `can_join_live` takes the typing topics = `can_read_channel` / `is_dm_participant`. Send: insert policy `live_typing_send` on `realtime.messages` (broadcast only), `can_send_live` = `can_post_in` / `can_send_dm`. Read-only channel readers see staff typing but cannot send.
- Events `typing` and `typing_stop`, payload `{ profileId }` only. Names come from data the page already has (channel members, DM other side); unknown ids are dropped, self never shown.
- Client: `useTyping` (`src/components/Typing`) over `joinTyping` (`src/lib/realtime/typingChannel.ts`). Sends only after join, at most once per 2.5 s while typing; a typer expires 5 s after the last event. Stop on send, blur, emptied box and unmount. Line under the composer (`TypingIndicator`, `aria-live="polite"`): "X is typing…", "X and Y are typing…", "Several people are typing…".
- `DATA_SOURCE=fake` or signed out: no typing config, nothing joins.
- `check:realtime` now also fails when a client sends the `stale` event.
- Caveat: payloads are not verified. A member who may post could send another member's id. Low harm (a wrong "typing" line); fix would need a server relay.
- G0: help.kajabi.com documents no typing indicator in Community chat or DMs (checked 2026-11-12). Kept as planned (PLAN item 7): extra over Kajabi.

Launch 6 item 8 as built:
- G0: Kajabi meetups repeat (daily / weekly on days / monthly, every N, end never / after N / on date); edit or cancel "this event", "this and following" or "all events". https://help.kajabi.com/en/articles/12695277-create-a-community-meetup, https://help.kajabi.com/en/articles/12695266-host-live-rooms-and-events-in-your-community (checked 2026-11-12).
- Migration `20261112140000_recurring_meetups.sql` + `supabase/tests/180-recurring-meetups.test.sql` (28 asserts), applied to ksb 2026-11-12.
- Model: a meetup stores its first occurrence (UTC + IANA zone) plus `repeat_*` rules. Occurrence n is computed in O(1), never stored: `src/lib/calendar/recurrence.ts`, SQL mirror `meetup_occurrence_start`. Dates step in the meetup zone and keep wall-clock time across DST. Monthly = same ordinal weekday; a 5th one means the last. Weekly always includes the start's own weekday.
- `meetup_occurrences` holds "this event only" edits (title, description, times, replay) and cancels. Cancel drops its RSVPs. RSVPs, join link and RSVP count are per occurrence. A shorter or moved series drops edits and RSVPs of occurrences that no longer exist. RLS rules unchanged (read = `can_read_meetup`, write = `can_edit_community`).
- Scopes: this = override row; following = `split_meetup` (staff only; new series from that occurrence, edits and RSVPs move, renumbered) then "all" on the new series; all = move the series by the wall-clock change of that occurrence (`movedSeries`) and clear the same fields in every override. One-offs are always "all"; cancelling one deletes it.
- The edit form posts every field; only fields that differ from the shown occurrence apply. In "this", a value equal to the series clears the override.
- URL key: meetup id for occurrence 0 (old links work), else `id_n`. `.ics` = one VEVENT per occurrence, UID `<key>@masterclass`, because edits are per occurrence (no RRULE + EXDATE to keep in sync).
- Listings bounded: members see 3 past + 10 upcoming per series, Studio 5 + 20. Series end search capped at 100000 occurrences.
- Studio: repeat fields on the meetup form; `studio/communities/[id]/events/[meetup]` lists sessions to edit or cancel with a scope picker (redirects to the events list when gone). The series form does not clear per-occurrence edits.
- Decisions: no per-occurrence location (join link is per series); replay is per occurrence (series replay = occurrence 0); a "following" split of a monthly last-weekday series keeps the ordinal of the split date, so a split on a 4th Thursday that was also the last can drift.

Launch 6 item 9 as built:
- G0: help.kajabi.com does not say whether the Coaching Scheduler shows slots in the client's zone; it documents coach availability in the coach's zone, and Meetups converted to each member's device zone. https://help.kajabi.com/en/articles/17174388-connect-the-kajabi-scheduler-to-a-coaching-program, https://help.kajabi.com/articles/products/community/are-meetups-shown-in-my-timezone (checked 2026-11-12). Followed the Meetups behaviour. No stored client zone (nothing in Kajabi docs says it stores one).
- Zone source: `ViewerZoneScript` in the space layout stores the browser `Intl` zone in cookie `tz` on every full page load (Next guide "Preventing flash before hydration", InlineScript pattern). Coaching client pages read it with `currentViewerZone` (`src/lib/time`), validated as an IANA zone, fallback = coach zone. Times are formatted on the server: no hydration mismatch, no flash.
- Shown in the client's zone: open slots (grouped by the client's day), session list, session page, reschedule slots. Coach's zone stays as secondary text (field hint, "Coach: ...", "Coach's time: ...") when it reads differently. `.ics` stays UTC, so calendar apps show device time.
- Booking still posts the UTC instant; server checks unchanged. Studio stays in the coach zone.
- Limit: the very first request on a host has no cookie yet and shows the coach zone (labelled). A changed device zone applies from the next full page load.
- Follow-up, meetups (G0: Kajabi shows meetups in the member's device zone, link above): member meetup list, detail and every recurring occurrence use the same `tz` cookie. The meetup's own zone stays as secondary text ("Meetup's time: ...") when it reads differently; the repeat line names the meetup zone then (weekdays are in that zone). Shared helper `zonedText` (`src/lib/time`) for coaching and meetups; `currentViewerZone()` returns null without a valid cookie, the caller falls back to the event zone. Studio and `.ics` unchanged. No meetup reminders are rendered yet (email pending).

Launch 6 item 10 as built:
- "Download all" button on the member's download page, only with 2+ files. Client component `DownloadAll`: clicks a temporary `<a download>` per file, one every 500 ms (`DOWNLOAD_GAP_MS`), each pointing at the existing signed-redirect route. Browser may ask once to allow multiple downloads. Access is still checked per file by that route; no new route, no DB change.
- Decision (user, 2026-11-12): NO zip. A zip route would stream every file through Vercel (function duration limit, transfer cost). `<a download>` is the standard script-started download (MDN); hidden iframe is legacy.
- Not yet: no progress per file; a browser that blocks multiple downloads blocks the later ones until the member allows it.

Launch 6 item 11 as built:
- G0: Kajabi quizzes (multiple choice and checkboxes, pass mark, retakes), assessments vs quizzes, completion certificates at 100%. https://help.kajabi.com/en/articles/12695109-course-quizzes, https://help.kajabi.com/en/articles/12695432-differences-between-quizzes-and-assessments, https://help.kajabi.com/en/articles/17174484-course-completion-certificates, https://help.kajabi.com/hc/en-us/articles/360048709013 (checked 2026-11-12).
- Migrations `20261112150000_quizzes.sql` + `supabase/tests/190-quizzes.test.sql` (26 asserts), `20261112160000_certificates.sql` + `supabase/tests/200-certificates.test.sql` (12 asserts), applied to ksb 2026-11-12.
- Quiz = part `kind = quiz` with questions and options. Answer key in `quiz_keys` (editor-only RLS). `submit_quiz` grades on the server: a question is right when the picked options are exactly the correct ones; score = percent right. Optional pass mark 1-100 (blank: any attempt passes). Unlimited retakes; members see score, pass state and which questions were right, never the answers.
- Quiz lock: `modules.unlock_quiz_part_id`, checked in `can_read_step`, the outline and step access. Any passed attempt opens the module for good.
- Certificate: Studio toggle per program (`products.certificates`, programs only). `issue_certificate` gives one row per member and program once every published step of every published module is done (grant needed; editors without a grant get none). Issued certificates stay valid when content is added later.
- PDF drawn on the server per download with pdf-lib (pure JS, MIT): A4 landscape, program theme else space brand else default colours, space name as wordmark, member display name (else email), program title, issue date, certificate id as serial. Route `programs/[program]/certificate` (404 unless earned). Link "Download certificate" in the program outline at 100%.
- Logo, brand fonts and public share page: see "Group 2 certificates as built".
- Not yet: certificate email, background image, expiration, assessments, quiz question images, answer reveal.

Launch 6 item 12 as built:
- G0: Kajabi coupons (code, percent or amount, limit, expiry, per offer), order bumps (extra offer ticked at checkout), upsells (offer after purchase). https://help.kajabi.com/articles/sales/coupons/how-to-create-a-coupon, https://help.kajabi.com/articles/sales/coupons/why-is-my-coupon-not-working, https://help.kajabi.com/articles/sales/checkout/how-to-add-an-order-bump-to-your-offer, https://help.kajabi.com/en/articles/17174752-upsells-overview, https://help.kajabi.com/en/articles/17174683-are-upsells-and-order-bumps-processed-as-one-transaction (checked 2026-11-12). PayPal line items + discount: https://developer.paypal.com/docs/api/orders/v2/#orders_create.
- Migration `20261112170000_coupons_bumps_upsells.sql` + `supabase/tests/210-coupons-bumps-upsells.test.sql` (20 asserts), applied to ksb 2026-11-12.
- Coupons: `coupons` + `coupon_offers`, offers.manage-only RLS (checkout reads them as service). Code uppercase `A-Z 0-9 _ -`, 3-32, unique per space. Percent 1-100 or amount with currency. Optional max uses, expiry date (ends 00:00 UTC that day), once per customer (by email), active toggle. Works only on the offers ticked (none ticked = no offer). Studio: Coupons nav (offers.manage), list + create (code, discount), coupon page (limits, expiry, offers, active, delete). A used coupon cannot be deleted; turn it off instead.
- Price on the server only: `priceCheckout` (offer - coupon + bump). Coupon applies to the main offer, amount capped at its price, amount coupon in another currency refused. Total 0 goes the free path. Checkout re-checks every rule before the PayPal order; "Apply" only previews (skips once-per-customer).
- Coupon field shows only when the offer has an active coupon (as Kajabi).
- Order stores `amount_cents` (paid total), `coupon_id`, `discount_cents`, `bump_offer_id`, `bump_cents`. Coupon uses are not stored: count of the coupon's orders past `created`, so the idempotent `fulfil_order` flip counts each once. Analytics and revenue read `amount_cents` = paid amount. Livemode unchanged.
- Bump: Studio "Order bump and upsell" on the offer page. Bump must be another offer of the space in the same currency; shown at checkout only when published. Separate PayPal line in the same order. `fulfil_order` grants the offer and bump products, each once. A sold bump offer cannot be deleted.
- Upsell: shown on the thanks page when published and the buyer does not already hold all its products; button starts a normal second checkout.
- Not yet: one-click upsell (needs PayPal vaulting; second checkout instead), coupon on bump or upsell price, max-uses race (two open checkouts can both pay past the limit by one), coupon reports, automatic discounts, bump/upsell in another currency.

Launch 6 item 13 as built:
- G0: Kajabi subscriptions (interval, optional free trial, member or creator cancel, access until period end), payment plans (fixed number of payments, limits per interval), failed payments (retries, then cancel). https://help.kajabi.com/en/articles/12695517-how-to-create-a-subscription-offer, https://help.kajabi.com/articles/sales/offers/create-a-payment-plan-offer, https://help.kajabi.com/en/articles/17174608-set-up-and-manage-subscriptions-with-kajabi-payments, https://help.kajabi.com/en/articles/17175348-cancel-a-customer-s-subscription, https://help.kajabi.com/en/articles/17174611-manage-failed-payments-with-kajabi-payments, https://help.kajabi.com/en/articles/17174766-coupons-for-subscriptions-and-payment-plans, https://help.kajabi.com/en/articles/17174659-add-order-bumps-to-an-offer (checked 2026-11-12). PayPal: https://developer.paypal.com/docs/api/subscriptions/v1/, https://developer.paypal.com/docs/api/catalog-products/v1/, https://developer.paypal.com/docs/subscriptions/integrate/, https://developer.paypal.com/api/rest/webhooks/event-names/.
- Migrations `20261112180000_subscriptions.sql` + `supabase/tests/220-subscriptions.test.sql` (26 asserts), `20261112190000_grant_expiry_renewal.sql`, `20261112200000_purchase_replaces_subscription_grant.sql`, applied to ksb 2026-11-12.
- Offer price type: `offers.kind` one_time / subscription / payment_plan, `billing_interval` week/month/year, `trial_days` 1-365 (subscriptions only), `installments` (payment plans only: weekly 2-104, monthly 2-24, annual 2-5). Recurring offers never free. Check `offers_recurring_terms` mirrors `recurringTermsError`. Studio: price type fields in offer Settings; create stays one-time.
- Payment plan = PayPal plan with `total_cycles` = installments. Price = per payment, set on the server.
- Terms copied onto `subscriptions` at checkout: editing the offer never changes what a buyer pays. PayPal plans cached in `provider_plans` per offer, env and terms key.
- Checkout: PayPal Subscriptions SDK button (`vault=true&intent=subscription`). After approval the server re-reads the status and activates; the webhook is the backup. Webhooks idempotent: status always re-read from PayPal, each sale recorded once (`subscription_payments` unique provider + sale id, `record_subscription_payment` locks the row).
- Grants follow the subscription (`grants.subscription_id`): active and past_due keep access; cancel (member, creator in PayPal) keeps access until period end (`expires_at`); SUSPENDED (retries failed) cancels in PayPal and revokes now; payment failed = past_due; EXPIRED plan or last installment paid = completed, access kept. A one-time purchase of the same product replaces a subscription grant.
- Member: Account > Subscriptions lists own subscriptions and plans with status and next date; "Cancel subscription" with a confirm step. Subscriptions only; a payment plan cannot be cancelled by the member. Always on (Kajabi has a toggle, off by default).
- Studio Customers: Subscriptions table (offer, price, status, test badge, payments n of N, paid until).
- Coupons and order bumps: one-time offers only (simplest). Coupon refused on recurring offers; bump hidden and refused on recurring offers; recurring offers cannot be a bump. Upsell can be any offer.
- `subscription_payments` keeps paid amount + livemode for revenue (G10). No revenue view yet.
- Not yet: real PayPal sandbox run (adapter tested with fake provider and mocked fetch only), Studio cancel/refund buttons (do it in PayPal), member self-cancel toggle, coupons on recurring offers, price change for existing subscribers, reactivation, dunning emails, one grant per product shared by two subscriptions of the same product.

UI pass 1 (site sections) as built:
- Model: alignedyoga (calm editorial base) + voicebodyconnection (personal variants). Layout and behaviour only, no copy, photos or brand (G0).
- Section images: public `site` bucket, path `<spaceId>/site/<id>-<name>`, upload via signed URL (`requestSiteImageUpload`), `ImageUpload` field in the section editor. Migration `20261112210000_site_images.sql` + `supabase/tests/230-site-images.test.sql`.
- New kinds: imageText (side left/right), bio (portrait + signature), cards (photo, title, link), highlights (chips). Hero layout overlay (full-bleed photo, scrim) or split. Every section has tone plain / soft / dark. `*word*` = accent italic.
- Bands are full-bleed; colours come from MDS tokens only, so any brand colour works.
- Images through next/image (`images.remotePatterns` from the Supabase URL). Vercel image optimization is billed by usage on Pro; check pricing before launch, or set `unoptimized`.
- Logo upload: Studio Branding (`space_branding.logo_path`), shown in the header and on certificates.

UI pass 2 (demo content, visitor reads) as built:
- Demo site: `node --env-file=.env.local scripts/seed-demo-site.ts [slug]` (default `fiddle`). Refuses spaces without `is_test`. Seeds CC0 Wikimedia photos, one offer, home (every section kind and tone), about (split hero), nav. Re-runnable.
- Bug found: visitor pages read the `pages` table, which RLS limits to site.edit, so visitors got the fallback. Visitor reads now go through the `published_pages` view (`repo.publishedPages` / `publishedPage`, type `PublishedPage`, no draft). Studio still reads `pages`.
- Hero overlay: backdrop now fills the whole band. Buttons on dark bands and photos use MDS `onMedia` (light ink).
- Header (`SpaceHeader`, sticky): space name in display font, site links small caps, Sign in button for visitors, account popover (avatar + unread badge: Library, Studio, Notifications, Subscriptions, Sign out) for members. Below 48rem one Menu button opens a bottom sheet with all of it.
- Footer: name + footer links, then legal links + copyright, on the sunken band.
- Browser icon: `/brand-icon.svg` route per space, first letter on ink (logo replaces it once uploaded). Route handler, not `icon.tsx`, because that convention links `/<slug>/icon`, which the host rewrite breaks.
- `Viewer` is now a union: signed in (profile + displayName) or visitor (both null).

UI pass 3 (walkthroughs: visitor, member, phone, Studio, platform) as built:
- G25 legal pages, export and account delete done.
- Toasts on every save; loading states on every route.
- Edit-form saves are the main button by default (`ActionForm` variant rule); inline and input-less forms stay secondary.
- UI shows labels, never stored values: `src/lib/labels.ts` (publish status, role, product kind), `PublishStatusBadge`, space status labels on the platform.
- Fake seed has a platform admin (`user-platform`, platform@example.test) that owns no space.
- Forgot password: blocked on transactional email.
- Done: offer form shows only the chosen price type's fields; coupon currency only for amount coupons; shared icon Move up/down buttons (MDS IconProvider, app icon set); row-level Remove is ghost, danger kept for a page's one destructive action; default accent is warm clay `#9a4a2c` with warm neutrals; token gate reads MDS component slots (`--mds-icon-slot`).
- Still open: MDS Avatar initials keep punctuation ("Robin (student)" gives "R("; fix in MDS `initials()`: first letter or digit per word), MDS badge/meta text is mono with no brand font slot (MDS), MDS `Field` label has no id, so a non-native control (TipTap editor) cannot use `aria-labelledby` and carries its own `aria-label`.
- Text parts: TipTap editor (`RichTextField`, heading, bold, italic, lists, quote, link), stored as a TipTap document in `parts.body`, read by `DocBody` (old plain-string rows still read).

Group 2 cleanup as built:
- Migration `20261115000000_storage_cleanup.sql` + `supabase/tests/290-storage-cleanup.test.sql` (29 asserts), applied to ksb 2026-11-12.
- Queue `storage_trash (bucket, path)`, service role only. `storage_columns()` lists every path column and its bucket (9 columns, 3 buckets). One AFTER DELETE / UPDATE OF trigger per table queues the old path on delete or change. `parts.poster_path` left out (unused, no bucket).
- Cascades reach the triggers, so deleting a community, space or profile (erase) queues every file below it. SQL test checks no rows of the community or space are left.
- Orphan sweep `storage_queue_orphans(grace)`: objects older than 24 h that no row and no site page or page version JSON points at. Covers uploads never saved and site images dropped from every page.
- `storage_trash_take` drops paths a row points at again (re-saved path) instead of handing them out. `storage_trash_done` forgets removed paths.
- Drain (`src/lib/storage/trash.ts`): per bucket, Storage API `remove` in batches of 1000, then `done`. A failing bucket stays queued, other buckets still drain, the error is thrown. A missing object is no error (Storage `remove` skips it).
- `drainSoon()` (`src/lib/storage/cleanup.ts`, Next `after()`) runs after every mutating action that can queue paths: studio curriculum, podcasts, downloads, community (posts, chat, reports, Studio), profile save, account delete, branding, coaching. A failure leaves the paths for the cron run.
- Cron route `GET /api/cron/storage`: `Authorization: Bearer <CRON_SECRET>` (`src/config/cron.ts`, constant-time check, min 32 chars, unset = refused). Queues orphans, then drains.
- Why one mechanism: the DB sees every cascade (space, community, channel, profile, module, step), so no caller has to list paths; a failed removal is not lost; `after()` keeps removal near-immediate. Commands no longer remove files. `erase_member_space` returns only `last_space`; `channel_files` dropped.
- Vault: `payment_credentials_cleanup` trigger deletes the PayPal secret with its row (space delete cascades here).
- Caveat: an upload left more than 24 h in an unsaved form is swept; the save then points at a missing object.
- Outside setup (not done): set `CRON_SECRET` (`openssl rand -hex 32`) in production; schedule `GET /api/cron/storage` with the Bearer header, for example daily via Vercel Cron (free on Hobby, once a day) or Supabase `pg_cron` + `pg_net`. Without it, orphans are not swept and failed drains wait.
- Fake mode: in-memory queue, no Storage, nothing swept.

Group 2 live updates as built:
- Migration `20261116000000_live_membership.sql` + `supabase/tests/300-live-membership.test.sql` (24 asserts), applied to ksb 2026-11-12. Same mechanism as Launch 6 item 5: empty `stale` hint, invalidate only.
- New topic `community:<id>` (SSOT `liveTopic.community`). Join = `can_read_community` (staff also on a draft).
- Hints on `community:`: `channels`, `access_groups`, `community_settings`, `post_approval_members`, `space_member_communities`, `channel_members` and `channel_moderators` (via channel), `grants` (community products only), `space_members` (every community of the space).
- `blocks` hint `inbox:` of blocker and blocked: DM pages and the nav refresh, so reply rights follow.
- `CommunityNav.live` = community topic plus own inbox while DMs are on; empty when signed out. `CommunityFrame` renders one `LiveRefresh` with `extras.live` plus the page topics (`live` prop: channel, post, dm). One listener set per page, so one hint burst = one refresh. The unread DM badge is live on every community page.
- Not hinted: `dm_reads` (opening a thread marks it read; would loop refreshes), grant expiry by time (no write), product publish or unpublish, the Space header notification badge.
- Caveat: the join check is cached per connection, so a member who loses access still gets the hint; the refresh then shows the locked page.
- G0: Kajabi live-update behaviour for these cases not checked on help.kajabi.com.

Group 2 push as built:
- Migration `20261117000000_push_settings.sql` + `supabase/tests/310-push-settings.test.sql` (9 asserts), applied to ksb 2026-11-12.
- `push_mutes` (space, profile, type): one row = push off for that type on that space. No row = on. Type check mirrors `NOTIFICATION_TYPES` (SSOT, `sqlMirror.test.ts`). FK to `space_profiles`, cascade. RLS: member reads, adds, deletes own rows; add needs a profile on that space.
- Repo: `pushMutes(spaceId, profileIds)` (service role, send path), `setPushMute` (as the member).
- Send: `sendPush` drops muted recipient + type pairs before the subscription lookup. The in-app notification is still written.
- UI: /notifications, under the device switch, "Push me about": one MDS `Switch` per type, one save (`ActionForm`, pending state, toast "Push settings saved"). Shown only when push is configured. `savePushTypesAction` in `features/community/actions.ts`.
- Icon: `spaceIconSrc` (`app/[space]/spaceIcon.ts`) = uploaded favicon URL or null. One source for favicon, manifest icon and push icon. No favicon: no icon in the payload (browser default). An SVG favicon may not render as a push icon on some platforms.
- iOS tap parking (KSG port, copied): the worker parks the tap URL in Cache Storage (`masterclass-notification-tap`, 60 s TTL) before focusing or opening a window, and posts `{ type: 'navigate', url }` to an open client. `NotificationTap` (space layout, with `PushHeal`) takes a parked tap on launch and listens for messages; same-origin paths only (`sameOriginPath`), the entry is consumed before it is checked. Reason: iOS home-screen apps can drop `openWindow`/`navigate` URLs.
- Report push: `reportAction` moved to `app/[space]/reportActions.ts` with `pushingRepo`; components take it as a `report` prop (`FormAction`). No `report` prop = no Report button.
- G0: Kajabi has per-feature, per-channel member notification preferences, all on by default, with admin overrides and channel mute (https://help.kajabi.com/en/articles/17175826-community-settings-notifications). Built: member per-type switches, default on. Kajabi's exact type list and wording not matched; follows KSG types.
- Not built: Kajabi admin community-level overrides, per-channel mute, email channel; mark-read on tap (payload has no notification id); badge count; KSG tag/renotify; `push_mutes` not in the member data export (same as `push_subscriptions`).

Group 2 certificates as built:
- G0: Kajabi certificates have a logo, background image, expiration and a share URL for social media (https://help.kajabi.com/en/articles/17174484, checked 2026-11-12). Fonts, indexing and revoking a link are not described. Built: logo, brand fonts, share page. Not built: background image, expiration.
- Migration `20261118000000_certificate_share.sql` + `supabase/tests/320-certificate-share.test.sql` (16 asserts), applied to ksb 2026-11-13.
- `certificates.share_token`: null = not shared. 32 hex chars (128-bit random), not the serial, unique, format check.
- `set_certificate_sharing(program, shared)` (security definer, member's own row): on keeps the token, off sets null, on again makes a new one, so the old link dies. Needs certificates on (`certificates_off`) and a space display name (`certificate_needs_name`), so an email is never public.
- `shared_certificate(space, token)` (security definer, anon allowed): returns member name, program title, issue date, serial only. Empty when the token is wrong, belongs to another space, or certificates are off for the program. Anon still reads no `certificates` rows (RLS unchanged).
- Repo: `certificate`, `setCertificateSharing`, `sharedCertificate` (fake + Supabase, contract test).
- Decision: sharing is off until the member turns it on (Kajabi shows the URL always). Member can stop sharing; the owner turning certificates off kills every link of that program.
- Program page: "Share certificate" button at 100%; when shared, read-only link field and "Stop sharing" (confirm). `shareCertificateAction` issues the certificate if needed. Toasts "Share link on" / "Share link off".
- Public page `/certificates/[token]` (space host, server rendered, space theme, not the program colour override): logo (else space name), name, program, date, serial. `robots: noindex, nofollow`; Open Graph title, description, site name, logo image. `certificates` added to `RESERVED_PAGE_SLUGS`.
- PDF: logo from `space_branding.logo_path` (PNG or JPEG; WebP falls back to the space name; a failed fetch is an error, not hidden), fetched by `siteImageBytes` (fake mode: no logo). Fonts from the brand catalog (`src/lib/fonts/catalog.ts`): heading bold, body regular, TTFs in `src/lib/certificates/fonts` (SIL OFL), subset into the PDF with `@pdf-lib/fontkit` (new dependency: pdf-lib cannot embed custom fonts without it). No brand font: Lora + Inter. Glyphs a font lacks print as "?". `outputFileTracingIncludes` ships the TTFs with the route.
- Not built: certificate email, background image, expiration, WebP logo in the PDF, share page preview image of the certificate itself (OG image = logo).

Waiting on outside setup: Storage cleanup cron (`CRON_SECRET` + schedule, Group 2), transactional email (drip release, meetup + coaching reminders), Vercel Domains API, embedded live room (paid, G14), native marketing-tool integration, Capacitor (only if wanted).

**Later** — drip release emails (`pg_cron`), embedded live room, Vercel Domains API, Capacitor, native marketing-tool integration.

## Costs (warn, verify on official pricing pages before signup)

- Vercel: Hobby forbids commercial use → **Pro** needed (per-seat monthly).
- Supabase: Free pauses + no backups → **Pro** (monthly per project + usage). Free upload cap 50 MB (episodes up to 250 MB need Pro). Egress Pro: 250 GB uncached + 250 GB cached included, then $0.09 / $0.03 per GB (https://supabase.com/docs/guides/platform/manage-your-usage/egress); podcast audio is the main egress driver.
- Vimeo: plan with embed domain allow-list (KSG client has Pro); each instructor's account or one shared.
- PayPal: per-transaction fees (percent + fixed, varies by country/currency, cross-border extra) charged to each instructor's own account; platform pays nothing. Verify current EU rates on PayPal's official fees page.
- Email provider (transactional only, G16): free tier likely enough at start.
- Google Calendar API: free, quota limits (verify).
- Live video provider: none in v1 (G14).
- Domains: instructors own/buy; platform domain ~€10–20/yr (G17).
- No app-store fees (G20).

## Decisions (grill, 2026-11-09)

| # | Decision |
|---|---|
| G0 | **Guiding rule: mimic Kajabi's feature behaviour** (verified against help.kajabi.com, never guessed) unless a decision below says otherwise. Behaviour, not their visuals/copy/brand |
| G11 | Public site Kajabi-scope: home, program sales/landing pages, custom pages, **blog**, editable header nav + footer, thank-you/claim page. Builder = Kajabi model: pages → sections → blocks, add/reorder/hide/duplicate, live preview, draft/publish. Checkout = our branded page with **PayPal JS SDK buttons** (Kajabi-like checkout page; card data stays in PayPal's hosted fields/popup, PCI stays PayPal's) (G28) |
| G1 | Audience = closed group. Two now, more added by hand. Minimal platform admin screen: create space, assign owner, attach domain. No self-serve instructor signup, no platform billing. SaaS later = additive |
| G2 | One global account (one auth user per email). Per-space profile `space_profiles(space_id, profile_id, display_name, avatar_path, bio)`. Login per domain (cookies per domain). RLS hides other-space membership from staff |
| G3 | Merchant = each instructor, own account. ~~Stripe first~~ → **PayPal first** (G28). Stripe adapter later behind same `PaymentProvider` interface. No automatic tax calculation; prices entered tax-inclusive. Both instructors EU sellers: OSS VAT = their accountant |
| G4 | Buyer → student, Kajabi way: guest checkout; known email = purchase added to existing account; new buyer auto-logged-in on success page → set password. Confirmation email carries **10-day claim link** (own `claim_tokens`, hashed, single-use — Supabase magic link max 24h, verify in docs). Per-space "password at checkout" toggle = later. No Google sign-in v1. Transactional email provider + per-domain sender (SPF/DKIM) in phase 0 |
| G6 | Kajabi model: **step = lesson page, ticked once**. Parts = ordered content blocks on the step page (video, text, download, image), not separately completed. Progress counts steps; bars at program + module. `part_progress` → `step_progress(profile_id, step_id, completed_at)` + `video_position(profile_id, part_id, last_position_s)` for resume |
| G7 | Completion Kajabi way: **"Complete & Continue" button** on step page, un-tick allowed, sidebar checkmarks. No auto-complete on web (Kajabi app's 90% rule = maybe later). Locking per **module**, not step: `modules.unlock_after_step_id` nullable — module opens once that step is ticked. Enforced in RLS (`can_read_step`). Only published steps count |
| G8 | Drip in v1, per module: `modules.release_after_days` (from `enrollments.granted_at`) + `modules.release_at` (fixed date). Same `can_read_step` helper as G7. UI "Opens in N days". Release email = phase 8 (`pg_cron`) |
| G9 | Vimeo = each instructor's own account (Natasha has one). App stores id only, account-agnostic. Space settings show setup checklist (hide from Vimeo, embed only on space domain + `staging.<platform>`, downloads off). Fixed staging domain, since Vercel preview URLs cannot be allow-listed |
| G10 | One Supabase project, KSG way. Migrations additive-first, go up before app PR. Consequence: staging domain reads prod DB → `orders.livemode bool` = credential env (`live` vs `sandbox`); staging deploy uses PayPal sandbox credentials; test orders filtered from analytics/revenue; test spaces flagged `spaces.is_test`. CI still runs `db reset` from scratch |
| G5 | v1 pricing = **one-time payment only**. `offers.kind` enum keeps room (`subscription`, `payment_plan` later, clients undecided). Access lifetime by default; `access_days` nullable column reserved. Refund behaviour decided when refunds built |
| G12 | Community = **full Kajabi Communities**: channels (feed or real-time chat; public / private / read-only), posts + comments + reactions + mentions (KSG port, comments polymorphic), meetups (scheduled, live room), events, challenges (points), points + leaderboard (7d / 30d / all-time), member directory, DMs, access groups (per-tier feature toggles), renameable labels. Biggest scope item, own phase group: feed channels (KSG port) first, then chat, DMs, challenges, leaderboard, meetups. Sources: [Build Kajabi Communities](https://help.kajabi.com/articles/products/community/build-kajabi-communities), [Access Groups](https://help.kajabi.com/en/articles/17174417-community-access-groups), [Gamification](https://help.kajabi.com/articles/products/community/community-settings-gamification) |
| G13 | Community = **own product**, Kajabi model. `products(id, space_id, kind program \| community, ...)`; offers grant any mix of products (`offer_products`). Community has `access_groups`; offer can grant an access group. Program may link to "its" community → "Community" tab in course. Cohort = access group. Replaces "one community per program" + `posts.program_id` (now `posts.channel_id`, channel belongs to community) |
| G14 | Meetups v1 = scheduled event + external link (Zoom/Meet), link shown at start time, RSVP, `.ics`, reminder, replay Vimeo id after. Embedded live room (Daily / LiveKit / Whereby) later behind `LiveRoomProvider` interface, after cost check on official pricing pages. No new bill v1 |
| G15 | Roles = Kajabi model. `space_members.role = owner \| admin \| assistant \| support`. Owner: all incl. payment credentials/payouts. Admin: all except payments + API keys. Assistant: content edit + community moderation. Support: students/contacts + comment moderation, no community moderation. One SSOT matrix role → capability (TS const + SQL `has_capability(space_id, cap)`), unit + RLS tested. Staff reach communities only if ticked: `space_member_communities`. Channel-scoped `channel_moderators(channel_id, profile_id)` for trusted students. Sources: [Add and manage account users](https://help.kajabi.com/hc/en-us/articles/4413468477211-Admin-users), [Community moderation tools](https://help.kajabi.com/articles/products/community/community-moderation-tools) |
| G16 | **No marketing suite** (exception to G0): no broadcasts, sequences, automations, forms builder. Instructors use external tool (MailerLite / Kit / Brevo). We keep: `contacts` (buyers, students, opt-ins) with `marketing_consent` + consent timestamp/source (GDPR), optional consent checkbox at checkout, CSV export in Studio, signed outbound webhooks (`order.paid`, `enrollment.created`, `contact.opted_in`) per space. Native integration to chosen tool = later. Transactional email (receipts, claim link, community notifications) stays ours (G4) |
| G17 | Platform name/domain = placeholder now. Working name `masterclass`; host from one SSOT constant (`PLATFORM_HOST` env, read in one config module). Platform host serves: platform admin, `staging.<platform>`, default space address `<slug>.<platform>` (wildcard subdomain) until custom domain attached, fallback email sender. Real name + domain bought before phase 7 (domains go live) |
| G18 | Product types = `program`, `community`, `coaching` (1:1 + group sessions), `podcast` (episodes, private feed for buyers), `download` (file product). All sold via offers (G13). Built after core (program + community + commerce). Excluded from Kajabi's 8: Newsletters (conflicts G16), Expert Agents (paid AI, separate decision), Backstage (per-client private space; revisit with coaching). Coaching live video follows G14 (external link first). Sources: [Products overview](https://help.kajabi.com/en/articles/17174383-kajabi-products-overview), [Coaching overview](https://help.kajabi.com/en/articles/17173830-coaching-product-overview), [Kajabi Scheduler](https://help.kajabi.com/articles/products/coaching/kajabi-scheduler-overview) |
| G19 | **Own scheduler** in coaching v1 (Kajabi parity). Coach availability rules (weekly + date overrides), time zone per coach and client (stored UTC, IANA zone), buffers, min notice, booking window. Google Calendar sync: OAuth, free/busy read, event write (free API; verify quotas in Google docs). 1:1 = client self-books via widget; group = coach schedules. Reschedule/cancel with cutoff, `.ics` + email confirmations. Double-booking prevented in DB (exclusion constraint on coach + time range). Session live video per G14 |
| G20 | Mobile = **PWA, KSG way**. Manifest generated per domain (route handler, SSR): space name, icons, theme colors from `space_branding`. Port KSG push stack (`lib/push/*`, `push-sw.js`, `PushHeal`), iOS 16.4+ when installed. No app stores. Capacitor wrapper = later, only if clients want store presence |
| G21 | Local dev = **KSG way, no Docker**. Commands `--linked` to hosted project; `supabase start` + `db reset` only in CI. Guards: dev data lives in `spaces.is_test` spaces only; SQL tests run inside a rolled-back transaction; PayPal sandbox credentials + `orders.livemode=false` (G10); PayPal webhooks hit `staging.<platform>`, not localhost; migrations additive-first, applied only after CI `db reset` green |
| G22 | Launch 1 = program + community core (feed channels, KSG port) + site + PayPal commerce + branding + PWA + domains. Then L2 chat/DMs/access groups, L3 gamification + meetups, L4 coaching + scheduler, L5 podcast + downloads. See Launches section |
| G23 | Launch 1 checkout = plain: one offer, one price, no coupons, order bumps, upsells. All three later, built in Launch 6 item 12 (own coupon table applied server-side before PayPal order create; extra line item; upsell = second checkout, PayPal vaulting only if needed) |
| G24 | `spaces.locale` column from day one; all UI strings + transactional emails through the i18n layer (KSG en/de catalog pattern). Launch 1 ships `en` catalog only; `de` later = catalog only. Instructor content in any language. PayPal JS SDK `locale` follows space |
| G25 | EU legal built in, Launch 1. Legal notice (Impressum), privacy, terms = builder pages flagged `legal_kind`, pinned in footer, required before site publish (texts from instructor's lawyer/generator, not us). Checkout: digital-content withdrawal-waiver checkbox, stored on `orders` with timestamp + text version. Only essential cookies + cookieless page-view counts → no banner. Student self-serve data export (JSON) + account delete (per space; global account deleted when last space left). DPA platform ↔ each instructor. Data residency EU: Supabase region Frankfurt, Vercel functions `fra1` (verify both in docs) |
| G26 | Quizzes + certificates later (built in Launch 6 item 11). Room kept: `parts.kind` enum can add `quiz`; module unlock rule can add `quiz_passed` (G7 column becomes rule when needed, additive). Certificate = branded PDF on 100% program completion |
| G27 | KSG stays separate forever. Port = copy into new repo, diverge freely. No shared package, no cross-project coupling. Any future migration = one-off import script |
| G28 | **PayPal first** (replaces Stripe in G3/G11). Each instructor: PayPal Business account + own REST app; client ID + secret pasted in Studio (owner only), secret in Supabase Vault; sandbox + live pair per space; own webhook per space. No Multiparty/Partner Referrals (needs PayPal partner approval, live APIs 401 without it) — revisit if SaaS. Checkout: PayPal JS SDK buttons on our branded page, server-side create + capture (Orders v2), webhook backup, idempotent on capture id. Withdrawal-waiver checkbox (G25) must be ticked before buttons enable. Refunds/disputes: instructor handles in PayPal dashboard v1; webhook `PAYMENT.CAPTURE.REFUNDED` revokes grant. Sources: [Multiparty seller onboarding](https://developer.paypal.com/docs/multiparty/seller-onboarding/), [Partner Referrals v2](https://developer.paypal.com/api/partner-referrals/v2) |

## Open

- Real platform name + domain (before phase 7, G17).

## Verification

- Per phase: `pnpm verify` (lint, gates, typecheck, Vitest, build).
- `pnpm test:sql` — RLS: student of space A cannot read space B rows; unenrolled cannot read parts; staff of A cannot edit B.
- Playwright e2e on two dev hosts (`alexander.localhost`, `natasha.localhost`): branding differs, sales page SSR renders + metadata, manual enrol → player → complete parts → progress bar updates, community post/comment/reaction.
- Lighthouse on public sales page (SEO, perf).
- Close Playwright browser after MCP runs.
