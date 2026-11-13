// Supabase Repo: certificates (G26) and share links. Semantics mirror src/lib/data/fake/fakeCertificateRepo.ts;
// rules live in issue_certificate, set_certificate_sharing and shared_certificate
// (20261112160000_certificates.sql, 20261118000000_certificate_share.sql).
import type { Repo } from '@/lib/data/repo';
import type { Certificate } from '@/lib/data/types';
import { toDate, unwrap, unwrapMaybe, type RepoCtx, type Row } from './context';

export type CertificateRepo = Pick<Repo, 'issueCertificate' | 'certificate' | 'setCertificateSharing' | 'sharedCertificate'>;

const toCertificate = (r: Row<'certificates'>): Certificate => ({
  id: r.id,
  programId: r.program_id,
  profileId: r.profile_id,
  issuedAt: toDate(r.issued_at),
  shareToken: r.share_token,
});

// Runs as the caller: the RPCs read auth.uid(); the certificates select policy shows own rows.
export function createCertificateRepo({ db }: RepoCtx): CertificateRepo {
  return {
    async issueCertificate(programId) {
      return toCertificate(unwrap(await (await db()).rpc('issue_certificate', { target_program: programId })));
    },

    async certificate(programId, profileId) {
      const row = unwrapMaybe(
        await (await db()).from('certificates').select('*').eq('program_id', programId).eq('profile_id', profileId).maybeSingle(),
      );
      return row ? toCertificate(row) : null;
    },

    async setCertificateSharing(programId, _profileId, shared) {
      return toCertificate(unwrap(await (await db()).rpc('set_certificate_sharing', { target_program: programId, shared })));
    },

    async sharedCertificate(spaceId, token) {
      const rows = unwrap(await (await db()).rpc('shared_certificate', { target_space: spaceId, token }));
      const row = rows[0];
      return row
        ? { memberName: row.member_name, programTitle: row.program_title, issuedAt: toDate(row.issued_at), serial: row.serial }
        : null;
    },
  };
}
