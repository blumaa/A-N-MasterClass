// PayPal webhook per space: https://<platform>/api/payments/paypal/<space slug> (G28).
// The raw text goes to verification untouched; PayPal signs the body exactly as sent.
import type { NextRequest } from 'next/server';
import { receiveWebhook } from '@/features/checkout/api/webhook';
import { getServiceRepo } from '@/lib/data/getRepo';
import { spaceProvider } from '@/lib/payments/spaceProvider';

export async function POST(req: NextRequest, ctx: RouteContext<'/api/payments/paypal/[space]'>) {
  const status = await receiveWebhook(getServiceRepo(), spaceProvider, (await ctx.params).space, req.headers, await req.text(), new Date());
  return new Response(null, { status });
}
