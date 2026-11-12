import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { Contact } from '@/lib/data/types';
import { contactsCsv, studioCustomers } from './customers';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  repo.db.members.push({ spaceId: SEED_IDS.alexander, profileId: SEED_IDS.student, role: 'support' });
  const offer = await repo.createOffer({ spaceId: SEED_IDS.alexander, slug: 'full', title: 'Full access', priceCents: 4900, currency: 'EUR' });
  await repo.createOrder({
    spaceId: SEED_IDS.alexander,
    offerId: offer.id,
    email: 'buyer@test',
    provider: 'fake',
    providerOrderId: 'po-1',
    amountCents: 4900,
    currency: 'EUR',
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: NOW,
    marketingConsent: true,
    createdAt: NOW,
  });
  const monthly = await repo.updateOffer(offer.id, { kind: 'subscription', billingInterval: 'month' });
  await repo.createSubscription({
    spaceId: SEED_IDS.alexander,
    offerId: monthly.id,
    email: 'sub@test',
    kind: 'subscription',
    provider: 'fake',
    providerSubscriptionId: 'FAKE-SUB-1',
    amountCents: 4900,
    currency: 'EUR',
    billingInterval: 'month',
    trialDays: null,
    installments: null,
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: NOW,
    marketingConsent: false,
  });
  await repo.upsertContact({ spaceId: SEED_IDS.alexander, email: 'buyer@test', profileId: null, consent: { source: 'checkout', at: NOW } });
});

const as = async (profileId: string, space = 'alexander'): Promise<Viewer> => (await resolveViewer(repo, space, profileId))!;

describe('studioCustomers', () => {
  it('lists orders with offer titles and contacts, for customers.manage (support role too)', async () => {
    const view = await studioCustomers(repo, await as(SEED_IDS.student));
    expect(view?.orders).toEqual([
      expect.objectContaining({ email: 'buyer@test', offerTitle: 'Full access', amountCents: 4900, status: 'created', livemode: false }),
    ]);
    expect(view?.contacts.map((c) => c.email)).toEqual(['buyer@test']);
    expect(view?.subscriptions).toEqual([
      expect.objectContaining({ email: 'sub@test', offerTitle: 'Full access', status: 'pending', livemode: false }),
    ]);
    expect(await studioCustomers(repo, await as(SEED_IDS.assistant))).toBeNull();
    expect(await studioCustomers(repo, await as(SEED_IDS.natashaOwner, 'natasha'))).toEqual({ orders: [], contacts: [], subscriptions: [] });
  });
});

describe('contactsCsv', () => {
  const contact = (extra: Partial<Contact>): Contact => ({
    spaceId: 's1',
    email: 'a@test',
    profileId: null,
    marketingConsent: false,
    consentAt: null,
    consentSource: null,
    createdAt: NOW,
    ...extra,
  });

  it('writes a header and one row per contact with ISO dates', () => {
    const csv = contactsCsv([contact({ marketingConsent: true, consentAt: NOW, consentSource: 'checkout' }), contact({ email: 'b@test' })]);
    expect(csv.split('\r\n')).toEqual([
      'email,marketing_consent,consent_at,consent_source,created_at',
      'a@test,yes,2026-11-10T12:00:00.000Z,checkout,2026-11-10T12:00:00.000Z',
      'b@test,no,,,2026-11-10T12:00:00.000Z',
      '',
    ]);
  });

  it('quotes commas and quotes, and defuses spreadsheet formulas', () => {
    const csv = contactsCsv([contact({ email: '=HYPERLINK("x")', consentSource: 'a,b' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a,b"');
  });
});
