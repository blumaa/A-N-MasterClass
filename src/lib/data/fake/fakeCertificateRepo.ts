// Certificate part of the fake repo. Same rules as issue_certificate in
// supabase/migrations/20261112160000_certificates.sql.
import { grantIsActive } from '../grants';
import { CERTIFICATE_NOT_EARNED, CERTIFICATES_OFF, ConstraintError } from '../errors';
import type { Repo } from '../repo';
import type { Db } from './db';

type CertificateRepo = Pick<Repo, 'issueCertificate'>;

export function createFakeCertificateRepo(db: Db, id: (prefix: string) => string): CertificateRepo {
  return {
    async issueCertificate(programId, profileId) {
      const program = db.products.find((p) => p.id === programId);
      const now = new Date();
      const granted = db.grants.some((g) => g.productId === programId && g.profileId === profileId && grantIsActive(g, now));
      if (program?.kind !== 'program' || program.status !== 'published' || !granted) throw new Error('program not open');
      if (!program.certificates) throw new ConstraintError(CERTIFICATES_OFF);
      const held = db.certificates.find((c) => c.programId === programId && c.profileId === profileId);
      if (held) return held;
      const modules = new Set(db.modules.filter((m) => m.programId === programId && m.status === 'published').map((m) => m.id));
      const counted = db.steps.filter((s) => modules.has(s.moduleId) && s.status === 'published');
      const done = new Set(db.stepProgress.filter((p) => p.profileId === profileId).map((p) => p.stepId));
      if (counted.length === 0 || counted.some((s) => !done.has(s.id))) throw new ConstraintError(CERTIFICATE_NOT_EARNED);
      const row = { id: id('cert'), programId, profileId, issuedAt: now };
      db.certificates.push(row);
      return row;
    },
  };
}
