// Completion certificate download (G26): issue (or reuse) the certificate row, then draw the PDF
// in the program theme, else the space brand, else the default brand. Fonts and logo come from
// the space branding.
import type { Viewer } from '@/lib/auth/viewer';
import { certificateFonts } from '@/lib/certificates/certificateFonts';
import { certificatePdf } from '@/lib/certificates/certificatePdf';
import type { Repo } from '@/lib/data/repo';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { programOutline } from './outline';

export type CertificateFile = { filename: string; serial: string; pdf: Uint8Array<ArrayBuffer> };
/** Reads a stored image by its storage path. Null when it cannot be read. */
export type ImageBytes = (path: string) => Promise<Uint8Array | null>;

export async function programCertificate(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  now: Date,
  imageBytes: ImageBytes,
): Promise<CertificateFile | null> {
  const outline = await programOutline(repo, viewer, programSlug, now);
  if (!outline?.certificateReady || !viewer.profile) return null;
  const { program } = outline;
  const [certificate, branding] = await Promise.all([
    repo.issueCertificate(program.id, viewer.profile.id),
    repo.branding(viewer.space.id),
  ]);
  const [fonts, logo] = await Promise.all([
    certificateFonts({ heading: branding?.fontHeading ?? null, body: branding?.fontBody ?? null }),
    branding?.logoPath ? imageBytes(branding.logoPath) : null,
  ]);
  const pdf = await certificatePdf({
    spaceName: viewer.space.name,
    programTitle: program.title,
    memberName: viewer.displayName,
    issuedAt: certificate.issuedAt,
    serial: certificate.id,
    colors: program.themeOverride ?? branding?.colors ?? DEFAULT_BRAND,
    fonts,
    logo,
  });
  return { filename: `${program.slug}-certificate.pdf`, serial: certificate.id, pdf };
}
