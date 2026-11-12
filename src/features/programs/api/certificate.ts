// Completion certificate download (G26): issue (or reuse) the certificate row, then draw the PDF
// in the program theme, else the space brand, else the default brand.
import type { Viewer } from '@/lib/auth/viewer';
import { certificatePdf } from '@/lib/certificates/certificatePdf';
import type { Repo } from '@/lib/data/repo';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { programOutline } from './outline';

export type CertificateFile = { filename: string; serial: string; pdf: Uint8Array<ArrayBuffer> };

export async function programCertificate(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  now: Date,
): Promise<CertificateFile | null> {
  const outline = await programOutline(repo, viewer, programSlug, now);
  if (!outline?.certificateReady || !viewer.profile) return null;
  const { program } = outline;
  const [certificate, branding] = await Promise.all([
    repo.issueCertificate(program.id, viewer.profile.id),
    program.themeOverride ? null : repo.branding(viewer.space.id),
  ]);
  const pdf = await certificatePdf({
    spaceName: viewer.space.name,
    programTitle: program.title,
    memberName: viewer.displayName ?? viewer.profile.email,
    issuedAt: certificate.issuedAt,
    serial: certificate.id,
    colors: program.themeOverride ?? branding?.colors ?? DEFAULT_BRAND,
  });
  return { filename: `${program.slug}-certificate.pdf`, serial: certificate.id, pdf };
}
