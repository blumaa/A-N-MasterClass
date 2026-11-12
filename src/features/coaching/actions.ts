'use server';
// Coaching writes. Studio edits (products.edit), client bookings, and the Google Calendar
// connection (settings.manage). Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { googleConfig } from '@/config/google';
import { platformHost } from '@/config/platform';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { googleClient } from '@/lib/google/server';
import { drainSoon } from '@/lib/storage/cleanup';
import { headersOrigin, platformOrigin } from '@/lib/tenancy/origin';
import { editBooking } from './api/booking';
import { calendarPortFor } from './api/googleCalendar';
import { disconnectCalendar, startConnect } from './api/googleConnect';
import { editCoaching } from './api/studio';
import { bookingCommandFromForm, coachingCommandFromForm } from './coachingFromForm';
import { googleConnectPath, studioCoachingHref } from './paths';

export type CoachingState = { message: string } | null;

const NO_EDIT = 'You do not have permission to edit coaching.';
const NO_SETTINGS = 'Only the owner or an admin can connect a calendar.';
const SIGN_IN = 'Sign in to book a session.';

const calendar = () => {
  const repo = getRepo();
  return { repo, port: calendarPortFor(repo, googleClient()) };
};

export async function editCoachingAction(_prev: CoachingState, form: FormData): Promise<CoachingState> {
  const parsed = coachingCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: NO_EDIT };
  const { repo, port } = calendar();
  const result = await editCoaching(repo, viewer, port, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, NO_EDIT) };
  drainSoon();
  refresh();
  return null;
}

export async function bookingAction(_prev: CoachingState, form: FormData): Promise<CoachingState> {
  const parsed = bookingCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer?.profile) return { message: SIGN_IN };
  const { repo, port } = calendar();
  const result = await editBooking(repo, viewer, port, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, SIGN_IN) };
  refresh();
  return null;
}

/** Step 1 of the Google round trip: sign the state here, continue on the platform host. */
export async function connectCalendarAction(_prev: CoachingState, _form: FormData): Promise<CoachingState> {
  const config = googleConfig();
  if (!config) return { message: 'Google Calendar is not set up on this platform yet.' };
  const viewer = await actionViewer();
  if (!viewer) return { message: NO_SETTINGS };
  const h = await headers();
  const origin = headersOrigin(h);
  const state = startConnect(viewer, config.stateSecret, origin + studioCoachingHref, new Date());
  if (!state) return { message: NO_SETTINGS };
  const url = new URL(googleConnectPath, platformOrigin(origin, platformHost()));
  url.searchParams.set('state', state);
  redirect(url.toString());
}

export async function disconnectCalendarAction(_prev: CoachingState, _form: FormData): Promise<CoachingState> {
  const viewer = await actionViewer();
  if (!viewer) return { message: NO_SETTINGS };
  const result = await disconnectCalendar(getRepo(), viewer, googleClient());
  if (!result.ok) return { message: failureMessage(result, NO_SETTINGS) };
  refresh();
  return null;
}
