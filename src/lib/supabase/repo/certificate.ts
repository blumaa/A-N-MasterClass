// Supabase Repo: certificates (G26). Semantics mirror src/lib/data/fake/fakeCertificateRepo.ts;
// rules live in issue_certificate (20261112160000_certificates.sql).
import type { Repo } from '@/lib/data/repo';
import type { Certificate } from '@/lib/data/types';
import { toDate, unwrap, type RepoCtx, type Row } from './context';

export type CertificateRepo = Pick<Repo, 'issueCertificate'>;

const toCertificate = (r: Row<'certificates'>): Certificate => ({
  id: r.id,
  programId: r.program_id,
  profileId: r.profile_id,
  issuedAt: toDate(r.issued_at),
});

// Runs as the caller: issue_certificate reads auth.uid().
export function createCertificateRepo({ db }: RepoCtx): CertificateRepo {
  return {
    async issueCertificate(programId) {
      return toCertificate(unwrap(await (await db()).rpc('issue_certificate', { target_program: programId })));
    },
  };
}
