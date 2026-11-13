// Certificate Supabase repo against the linked project. issue_certificate reads auth.uid(), so the
// member runs signed in (RLS: 200-certificates.test.sql). Share links read as anon (320-certificate-share.test.sql).
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabasePublic } from '@/config/supabase';
import type { Database } from '@/lib/db/database.types';
import { CERTIFICATE_NEEDS_NAME, CERTIFICATE_NOT_EARNED, CERTIFICATES_OFF, CERTIFICATES_PROGRAM_ONLY } from '@/lib/data/errors';
import { createCertificateRepo, type CertificateRepo } from './certificate';
import { createCoreRepo, type CoreRepo } from './core';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

describe.skipIf(!contractEnabled)('certificate repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let core: CoreRepo;
  let member: CertificateRepo;
  let student: string;
  let program: string;
  let step: string;

  beforeAll(async () => {
    fx = await createContractSpace('cert');
    core = createCoreRepo({ db: async () => fx.admin, admin: () => fx.admin });
    const prog = await core.createProduct({ spaceId: fx.spaceId, kind: 'program', slug: 'cert', title: 'C' });
    program = prog.id;
    await core.updateProduct(program, { status: 'published' });
    const mod = await core.createModule({ programId: program, title: 'M' });
    await core.updateModule(mod.id, { status: 'published' });
    step = (await core.createStep({ moduleId: mod.id, title: 'S' })).id;
    await core.updateStep(step, { status: 'published' });
    student = await fx.newUser('student');
    await core.createGrant({ productId: program, profileId: student, source: 'manual' });
    const client = await fx.signIn('student', student);
    member = createCertificateRepo({ db: async () => client, admin: () => fx.admin });
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  it('maps the toggle and keeps it to programs', async () => {
    expect((await core.product(program))?.certificates).toBe(false);
    const community = await core.createProduct({ spaceId: fx.spaceId, kind: 'community', slug: 'cert-c', title: 'C' });
    await expect(core.updateProduct(community.id, { certificates: true })).rejects.toThrow(CERTIFICATES_PROGRAM_ONLY);
  });

  it('issues once every published step is done, then returns the same row', async () => {
    await expect(member.issueCertificate(program, student)).rejects.toThrow(CERTIFICATES_OFF);
    expect((await core.updateProduct(program, { certificates: true })).certificates).toBe(true);
    await expect(member.issueCertificate(program, student)).rejects.toThrow(CERTIFICATE_NOT_EARNED);
    await core.setStepComplete(student, step, true);
    const cert = await member.issueCertificate(program, student);
    expect(cert).toMatchObject({ programId: program, profileId: student });
    expect(cert.issuedAt).toBeInstanceOf(Date);
    expect(await member.issueCertificate(program, student)).toEqual(cert);
  });

  it('shares through a random token that anon reads, and revokes it', async () => {
    const { url, publishableKey } = supabasePublic();
    const anonClient = createClient<Database>(url, publishableKey, { auth: { persistSession: false } });
    const anon = createCertificateRepo({ db: async () => anonClient, admin: () => fx.admin });
    const cert = (await member.certificate(program, student))!;
    expect(cert.shareToken).toBeNull();
    await expect(member.setCertificateSharing(program, student, true)).rejects.toThrow(CERTIFICATE_NEEDS_NAME);
    await core.ensureSpaceProfile({ spaceId: fx.spaceId, profileId: student, displayName: 'Ada' });
    const token = (await member.setCertificateSharing(program, student, true)).shareToken!;
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(await anon.sharedCertificate(fx.spaceId, token)).toEqual({
      memberName: 'Ada',
      programTitle: 'C',
      issuedAt: cert.issuedAt,
      serial: cert.id,
    });
    expect(await anon.certificate(program, student)).toBeNull();
    expect((await member.setCertificateSharing(program, student, false)).shareToken).toBeNull();
    expect(await anon.sharedCertificate(fx.spaceId, token)).toBeNull();
  });
});
