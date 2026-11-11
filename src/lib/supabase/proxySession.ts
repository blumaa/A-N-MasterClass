// Proxy step: refresh the Supabase session and carry new auth cookies onto whatever response the proxy returns.
// Pattern: https://supabase.com/docs/guides/auth/server-side/nextjs (updateSession).
import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/config/supabase';

type Pending = { cookies: { name: string; value: string; options: object }[]; headers: Record<string, string> };

/** Refreshes the session on the request; returns a function that writes the refreshed cookies onto a response. */
export async function refreshSession(request: NextRequest): Promise<(response: NextResponse) => NextResponse> {
  const pending: Pending = { cookies: [], headers: {} };
  const { url, publishableKey } = supabasePublic();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // Request cookies too, so Server Components in this request see the fresh session.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        pending.cookies = cookiesToSet;
        pending.headers = headers;
      },
    },
  });
  // Do not run code between client creation and getClaims (Supabase docs).
  await supabase.auth.getClaims();
  return (response) => {
    for (const { name, value, options } of pending.cookies) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(pending.headers)) response.headers.set(key, value);
    return response;
  };
}
