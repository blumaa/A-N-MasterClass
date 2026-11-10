'use server';
// Checkout Server Actions (public: the buyer may be a guest). Space from Host (actionViewer),
// never from arguments. Arguments come from the browser: coerce, the DAL validates.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { devAuthAllowed } from '@/config/dataSource';
import { paymentsEnv } from '@/config/payments';
import { actionViewer } from '@/lib/auth/actionViewer';
import { startDevSession } from '@/lib/auth/session';
import { getRepo } from '@/lib/data/getRepo';
import { PaymentProviderError } from '@/lib/payments/provider';
import { spaceProvider } from '@/lib/payments/spaceProvider';
import { completeCheckout, startCheckout } from './api/checkout';
import { claimAccount } from './api/claim';
import type { FulfilResult } from './api/fulfil';
import { claimPath, thanksPath } from './paths';

export type StartCheckoutState = { ok: true; providerOrderId: string } | { ok: true; next: string } | { ok: false; message: string };
export type CompleteCheckoutState = { ok: true; next: string } | { ok: false; message: string; retry: boolean };

const GONE = 'This offer is no longer available.';

/** New buyer: signed in right away (G4). Dev only until Supabase Auth; the claim link goes out by email later. */
async function afterFulfil(offerSlug: string, result: FulfilResult): Promise<string> {
  if (result.status === 'pending') return thanksPath(offerSlug, 'pending');
  if (result.newAccount && devAuthAllowed(process.env)) {
    await startDevSession(result.profileId);
    if (result.claimToken) {
      // Transactional email is not set up yet: show the receipt link in the dev server log.
      console.info(`[dev] claim link: http://${(await headers()).get('host')}${claimPath(result.claimToken)}`);
    }
  }
  return thanksPath(offerSlug, 'paid');
}

export async function startCheckoutAction(input: {
  offerSlug: string;
  email: string;
  waiverAccepted: boolean;
  marketingConsent: boolean;
}): Promise<StartCheckoutState> {
  const viewer = await actionViewer();
  if (!viewer) return { ok: false, message: GONE };
  const offerSlug = String(input.offerSlug);
  const result = await startCheckout(
    getRepo(),
    { env: paymentsEnv(), resolveProvider: () => spaceProvider(viewer.space.id) },
    viewer.space.id,
    { offerSlug, email: String(input.email), waiverAccepted: input.waiverAccepted === true, marketingConsent: input.marketingConsent === true },
    new Date(),
  );
  if (!result.ok) return { ok: false, message: result.error === 'invalid' ? result.message : GONE };
  if (result.kind === 'provider') return { ok: true, providerOrderId: result.providerOrderId };
  return { ok: true, next: await afterFulfil(offerSlug, result.fulfilment) };
}

export async function completeCheckoutAction(offerSlug: string, providerOrderId: string): Promise<CompleteCheckoutState> {
  const viewer = await actionViewer();
  const choice = viewer ? await spaceProvider(viewer.space.id) : null;
  if (!viewer || choice?.kind !== 'ready') return { ok: false, message: GONE, retry: false };
  try {
    const result = await completeCheckout(getRepo(), choice.provider, viewer.space.id, String(providerOrderId), new Date());
    if (!result.ok) return { ok: false, message: GONE, retry: false };
    return { ok: true, next: await afterFulfil(String(offerSlug), result.fulfilment) };
  } catch (error) {
    // PayPal: a declined card lets the buyer pick another funding source (actions.restart()).
    if (error instanceof PaymentProviderError && error.issue === 'INSTRUMENT_DECLINED') {
      return { ok: false, message: 'Your payment method was declined. Please choose another one.', retry: true };
    }
    throw error;
  }
}

/** Form post, not a link click: mail scanners that open links never use the token up. */
export async function claimAccountAction(form: FormData): Promise<void> {
  const token = String(form.get('token') ?? '');
  const viewer = await actionViewer();
  const profileId = viewer ? await claimAccount(getRepo(), viewer.space.id, token, new Date()) : null;
  if (!profileId) redirect(`${claimPath(token)}?error=1`);
  await startDevSession(profileId);
  redirect('/library');
}
