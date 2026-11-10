// Studio customers DAL: orders + contacts (G16), CSV export for the instructor's mailing tool.
// customers.manage only (owner, admin, support; G15).
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { Currency } from '@/lib/commerce/money';
import { toCsv } from '@/lib/csv/csv';
import type { Repo } from '@/lib/data/repo';
import type { Contact, OrderStatus } from '@/lib/data/types';

export type CustomerOrder = {
  id: string;
  email: string;
  offerTitle: string;
  amountCents: number;
  currency: Currency;
  status: OrderStatus;
  livemode: boolean;
  createdAt: Date;
};

export type CustomersView = { orders: CustomerOrder[]; contacts: Contact[] };

export async function studioCustomers(repo: Repo, viewer: Viewer): Promise<CustomersView | null> {
  if (!viewerCan(viewer, 'customers.manage')) return null;
  const spaceId = viewer.space.id;
  const [orders, offers, contacts] = await Promise.all([repo.orders(spaceId), repo.offers(spaceId), repo.contacts(spaceId)]);
  const titles = new Map(offers.map((o) => [o.id, o.title]));
  return {
    orders: orders.map((o) => ({
      id: o.id,
      email: o.email,
      offerTitle: titles.get(o.offerId) ?? '',
      amountCents: o.amountCents,
      currency: o.currency,
      status: o.status,
      livemode: o.livemode,
      createdAt: o.createdAt,
    })),
    contacts,
  };
}

const HEADER = ['email', 'marketing_consent', 'consent_at', 'consent_source', 'created_at'];

export function contactsCsv(contacts: readonly Contact[]): string {
  const rows = contacts.map((c) => [
    c.email,
    c.marketingConsent ? 'yes' : 'no',
    c.consentAt?.toISOString() ?? '',
    c.consentSource ?? '',
    c.createdAt.toISOString(),
  ]);
  return toCsv(HEADER, rows);
}
