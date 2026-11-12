// Content-Security-Policy for every response, set in next.config headers().
// No nonce: a nonce forces dynamic rendering of every page and disables ISR, which the public
// site relies on (Next docs, "Content Security Policy" > "Static vs Dynamic Rendering").
// 'unsafe-inline' for scripts/styles is therefore needed (Next inline bootstrap, branding <style>)
// and is also PayPal's own recommendation: https://developer.paypal.com/sdk/js/csp/
// Relative imports only: next.config.ts loads this file.

/** PayPal JS SDK hosts, per PayPal's CSP page. */
const PAYPAL = ['*.paypal.com', '*.paypalobjects.com', '*.venmo.com'];
/** Vimeo player iframe origin (VimeoEmbed src). */
const VIMEO_PLAYER = 'https://player.vimeo.com';

export type CspOptions = {
  dev: boolean;
  /** Supabase project origin (REST, Realtime, Storage reads and uploads); omitted until wired. */
  dataOrigin?: string;
};

export function contentSecurityPolicy({ dev, dataOrigin }: CspOptions): string {
  const data = dataOrigin ? [dataOrigin] : [];
  const realtime = dataOrigin ? [dataOrigin.replace(/^https:/, 'wss:')] : [];
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...PAYPAL]],
    ['style-src', ["'self'", "'unsafe-inline'", ...PAYPAL]],
    ['img-src', ["'self'", 'blob:', 'data:', ...data, ...PAYPAL]],
    ['font-src', ["'self'"]],
    // Episode audio: the app route 302s to a signed Storage URL.
    ['media-src', ["'self'", ...data]],
    ['connect-src', ["'self'", ...data, ...realtime, ...PAYPAL]],
    ['frame-src', ["'self'", VIMEO_PLAYER, ...PAYPAL]],
    ['child-src', ["'self'", ...PAYPAL]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ...(dev ? [] : [['upgrade-insecure-requests', []] as [string, string[]]]),
  ];
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ');
}

export type Header = { key: string; value: string };

export const securityHeaders = (options: CspOptions): Header[] => [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy(options) },
  // PayPal: "use Cross-Origin-Opener-Policy: same-origin-allow-popups" with the Web SDK.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];
