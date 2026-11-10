// Studio > Customers > CSV export (G16). customers.manage only; 404 otherwise.
import { contactsCsv, studioCustomers } from '@/features/checkout/api/customers';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/studio/customers/contacts.csv'>) {
  const viewer = await currentViewer((await ctx.params).space);
  const view = viewer ? await studioCustomers(getRepo(), viewer) : null;
  if (!viewer || !view) return new Response(null, { status: 404 });
  return new Response(contactsCsv(view.contacts), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${viewer.space.slug}-contacts.csv"`,
      'cache-control': 'no-store',
    },
  });
}
