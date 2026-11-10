'use server';
// Studio commerce Server Actions (offers, payment settings). Space from Host (actionViewer),
// never from the form; the DAL re-checks capabilities.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { editOffers } from './api/offers';
import { savePayments } from './api/payments';
import { studioOfferHref, studioOffersHref } from './paths';
import { offerCommandFromForm, paymentsInputFromForm } from './studioForms';

export type StudioFormState = { message: string } | null;

const OFFERS_FORBIDDEN = 'You do not have permission to manage offers.';
const PAYMENTS_FORBIDDEN = 'Only the site owner can change payment settings.';

export async function editOfferAction(_prev: StudioFormState, form: FormData): Promise<StudioFormState> {
  const parsed = offerCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: OFFERS_FORBIDDEN };

  const { command } = parsed;
  const result = await editOffers(getRepo(), viewer, command);
  if (!result.ok) return { message: failureMessage(result, OFFERS_FORBIDDEN) };
  if (command.op === 'create' && result.id) redirect(studioOfferHref(result.id));
  if (command.op === 'delete') redirect(studioOffersHref);
  refresh();
  return null;
}

export async function savePaymentsAction(_prev: StudioFormState, form: FormData): Promise<StudioFormState> {
  const parsed = paymentsInputFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: PAYMENTS_FORBIDDEN };

  const result = await savePayments(getRepo(), viewer, parsed.value, new Date());
  if (!result.ok) return { message: failureMessage(result, PAYMENTS_FORBIDDEN) };
  refresh();
  return null;
}
