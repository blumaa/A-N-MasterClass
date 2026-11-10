# Domains go live (phase 7 checklist)

How a host reaches a space: `src/proxy.ts` → `src/lib/tenancy/routeHost.ts`.

- Platform host (`PLATFORM_HOST`, `www.`, `staging.`): platform pages.
- `<slug>.<PLATFORM_HOST>`: that space.
- Any other host: looked up in `space_domains` (cached 60 s per server instance). Unknown host: 404.

Blocked on: the real platform domain (G17). Not bought yet.

## Once: the platform domain

1. Buy the domain. Set `PLATFORM_HOST=<domain>` in Vercel (Production + Preview).
2. In Vercel > Project > Settings > Domains, add `<domain>`, `www.<domain>`, `staging.<domain>` and `*.<domain>`.
   - Wildcard certificates need a DNS challenge. Either use Vercel nameservers, or keep external DNS and add
     `NS _acme-challenge` → `ns1.vercel-dns.com.` / `ns2.vercel-dns.com.` plus `CNAME *` → the target Vercel shows.
   - Apex: an `A` record. Subdomains: a `CNAME` to the project-specific target shown in Settings > Domains.
   - Source: https://vercel.com/docs/domains/working-with-domains/add-a-domain
3. In Supabase > Auth > URL Configuration, set Site URL to `https://<domain>` and add these redirect URLs:
   `https://<domain>/**`, `https://*.<domain>/**`, `https://staging.<domain>/**`.
   - `*` does not cross a `.`, so the wildcard covers one subdomain level, which is what spaces use.
   - Source: https://supabase.com/docs/guides/auth/redirect-urls
4. Point the PayPal sandbox webhook of each space at `https://staging.<domain>/api/payments/paypal/<slug>` (G21).

## Per space custom domain (e.g. `alexander-ma.com`)

1. The instructor owns the domain. Add it (and `www.` if wanted) in Vercel > Settings > Domains, then set the DNS records Vercel shows.
2. Attach it to the space (platform admin, v1 by hand):
   ```sql
   insert into public.space_domains (host, space_id, is_primary)
   values ('alexander-ma.com', (select id from public.spaces where slug = 'alexander'), true);
   ```
   `host` is lowercase with no port. One primary per space.
3. Supabase Auth: add `https://alexander-ma.com/**` to the redirect URLs.
4. Vimeo (the instructor's account): for each video, open Share > Embed > "Where can this be embedded?" and choose "Specific domains".
   Add the custom domain, `<slug>.<domain>` and `staging.<domain>` (G9). Up to 50 domains.
   - Source: https://help.vimeo.com/hc/en-us/articles/30030693052305-How-do-I-set-up-a-domain-level-privacy
5. PayPal live webhook: `https://alexander-ma.com/api/payments/paypal/alexander`. Studio > Payments shows the URL for the current host.
6. Transactional email sender domain (SPF/DKIM): when the email provider is chosen (deferred).

## Security headers

`src/lib/security/csp.ts`, applied to every route in `next.config.ts`.

- No nonce. A nonce forces dynamic rendering on every page and turns off ISR for the public site.
  Scripts and styles use `'unsafe-inline'`, which is also PayPal's documented recommendation.
- PayPal JS SDK hosts (`*.paypal.com *.paypalobjects.com *.venmo.com`) and `Cross-Origin-Opener-Policy: same-origin-allow-popups`
  follow https://developer.paypal.com/sdk/js/csp/
- The Vimeo player is allowed as a frame only (`https://player.vimeo.com`).
- `NEXT_PUBLIC_SUPABASE_URL`, once set, adds the project to `connect-src` (https + wss) and `img-src`.
- `frame-ancestors 'none'`: no one may frame the app. Revisit if a Studio live preview ever uses an iframe.
- `upgrade-insecure-requests` is on in production builds, so `pnpm start` on plain http localhost may break subresources. Use `pnpm dev` locally.
