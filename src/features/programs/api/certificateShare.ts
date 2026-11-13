// Public share link for a completion certificate (G26, Kajabi share URL). Off until the member
// turns it on; turning it off kills the link, and turning it on again makes a new one. The public
// page shows only member name, program title, issue date and serial.
import type { Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { SharedCertificate } from '@/lib/data/types';
import { programOutline, type Outline } from './outline';

const TOKEN = /^[0-9a-f]{32}$/;

/** Turn the viewer's share link on or off. Issues the certificate first when it is earned. */
export async function shareCertificate(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  shared: boolean,
  now: Date,
): Promise<CommandResult> {
  if (!viewer.profile) return { ok: false, error: 'forbidden' };
  const outline = await programOutline(repo, viewer, programSlug, now);
  if (!outline?.certificateReady) return { ok: false, error: 'not_found' };
  try {
    await repo.issueCertificate(outline.program.id, viewer.profile.id);
    await repo.setCertificateSharing(outline.program.id, viewer.profile.id, shared);
    return { ok: true };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}

/** The viewer's live share token for this program, or null. */
export async function certificateShareToken(repo: Repo, viewer: Viewer, outline: Outline): Promise<string | null> {
  if (!outline.certificateReady || !viewer.profile) return null;
  return (await repo.certificate(outline.program.id, viewer.profile.id))?.shareToken ?? null;
}

/** Public read for the share page. Malformed tokens never reach the database. */
export async function sharedCertificate(repo: Repo, spaceId: string, token: string): Promise<SharedCertificate | null> {
  return TOKEN.test(token) ? repo.sharedCertificate(spaceId, token) : null;
}
