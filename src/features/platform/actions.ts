'use server';
// Platform admin Server Actions (G1). Platform host only; the platform admin flag is checked here
// and again by RLS (is_platform_admin).
import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { currentPlatformAdmin } from '@/lib/auth/currentViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { claimPath } from '@/lib/routes';
import { requestOrigin, spaceOrigin } from '@/lib/tenancy/origin';
import { runPlatformCommand, type PlatformResult } from './api/spaces';
import { parsePlatformCommand } from './forms';

export type PlatformFormState = { message: string } | null;
/** claimUrl: one-time owner sign-in link to copy (no email yet). */
export type ClaimFormState = { message: string } | { slug: string; claimUrl: string } | null;

const FORBIDDEN = 'Only platform admins can do this.';

async function run(form: FormData): Promise<PlatformResult | { ok: false; message: string }> {
  const parsed = parsePlatformCommand(form);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  if (!(await currentPlatformAdmin())) return { ok: false, message: FORBIDDEN };
  return runPlatformCommand(getRepo(), parsed.command, new Date());
}

const message = (result: Exclude<Awaited<ReturnType<typeof run>>, { ok: true }>) =>
  'error' in result ? failureMessage(result, FORBIDDEN) : result.message;

/** Status and domain changes. */
export async function platformAction(_prev: PlatformFormState, form: FormData): Promise<PlatformFormState> {
  const result = await run(form);
  if (!result.ok) return { message: message(result) };
  refresh();
  return null;
}

/** New space, or a fresh owner claim link: both answer with the link to hand to the owner. */
export async function platformClaimAction(_prev: ClaimFormState, form: FormData): Promise<ClaimFormState> {
  const result = await run(form);
  if (!result.ok) return { message: message(result) };
  if (!result.slug || !result.claimToken) return { message: 'No claim link was made.' };
  const h = await headers();
  const origin = spaceOrigin(requestOrigin(h.get('host') ?? '', h.get('x-forwarded-proto')), result.slug);
  refresh();
  return { slug: result.slug, claimUrl: origin + claimPath(result.claimToken) };
}
