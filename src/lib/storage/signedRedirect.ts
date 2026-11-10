// Response for a private file after the access check: 302 to the signed URL, or 404. no-store so
// neither the browser nor a CDN keeps the redirect past the URL's short lifetime (SIGNED_URL_TTL_S).
export function signedRedirect(url: string | null): Response {
  if (!url) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store' } });
}
