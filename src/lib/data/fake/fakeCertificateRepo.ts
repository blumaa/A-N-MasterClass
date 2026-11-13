// Certificate part of the fake repo. Same rules as issue_certificate, set_certificate_sharing and
// shared_certificate in supabase/migrations (20261112160000_certificates, 20261118000000_certificate_share).
import { randomUUID } from 'node:crypto';
import { grantIsActive } from '../grants';
import { CERTIFICATE_NEEDS_NAME, CERTIFICATE_NOT_EARNED, CERTIFICATES_OFF, ConstraintError } from '../errors';
import type { Repo } from '../repo';
import type { Db } from './db';

type CertificateRepo = Pick<Repo, 'issueCertificate' | 'certificate' | 'setCertificateSharing' | 'sharedCertificate'>;

const newShareToken = () => randomUUID().replace(/-/g, '');

export function createFakeCertificateRepo(db: Db, id: (prefix: string) => string): CertificateRepo {
  const held = (programId: string, profileId: string) =>
    db.certificates.find((c) => c.programId === programId && c.profileId === profileId) ?? null;

  return {
    async issueCertificate(programId, profileId) {
      const program = db.products.find((p) => p.id === programId);
      const now = new Date();
      const granted = db.grants.some((g) => g.productId === programId && g.profileId === profileId && grantIsActive(g, now));
      if (program?.kind !== 'program' || program.status !== 'published' || !granted) throw new Error('program not open');
      if (!program.certificates) throw new ConstraintError(CERTIFICATES_OFF);
      const existing = held(programId, profileId);
      if (existing) return existing;
      const modules = new Set(db.modules.filter((m) => m.programId === programId && m.status === 'published').map((m) => m.id));
      const counted = db.steps.filter((s) => modules.has(s.moduleId) && s.status === 'published');
      const done = new Set(db.stepProgress.filter((p) => p.profileId === profileId).map((p) => p.stepId));
      if (counted.length === 0 || counted.some((s) => !done.has(s.id))) throw new ConstraintError(CERTIFICATE_NOT_EARNED);
      const row = { id: id('cert'), programId, profileId, issuedAt: now, shareToken: null };
      db.certificates.push(row);
      return row;
    },

    async certificate(programId, profileId) {
      return held(programId, profileId);
    },

    async setCertificateSharing(programId, profileId, shared) {
      const cert = held(programId, profileId);
      if (!cert) throw new Error('certificate not found');
      const program = db.products.find((p) => p.id === programId);
      if (!program?.certificates) throw new ConstraintError(CERTIFICATES_OFF);
      if (shared && !db.spaceProfiles.some((p) => p.spaceId === program.spaceId && p.profileId === profileId)) {
        throw new ConstraintError(CERTIFICATE_NEEDS_NAME);
      }
      cert.shareToken = shared ? (cert.shareToken ?? newShareToken()) : null;
      return cert;
    },

    async sharedCertificate(spaceId, token) {
      const cert = db.certificates.find((c) => c.shareToken === token);
      const program = cert && db.products.find((p) => p.id === cert.programId);
      if (!cert || !program || program.spaceId !== spaceId || !program.certificates) return null;
      const profile = db.spaceProfiles.find((p) => p.spaceId === spaceId && p.profileId === cert.profileId);
      if (!profile) return null;
      return { memberName: profile.displayName, programTitle: program.title, issuedAt: cert.issuedAt, serial: cert.id };
    },
  };
}
