'use server';
// Challenge + meetup writes. Studio edits (editEventsAction) and member entries/RSVPs.
// Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { challengeCommand } from './api/challenges';
import { meetupCommand } from './api/meetups';
import { editEvents } from './api/studioEvents';
import { challengeCommandFromForm, eventsCommandFromForm, meetupCommandFromForm } from './eventsFromForm';

export type EventsState = { message: string } | null;

const SIGN_IN = 'Sign in to take part.';
const NO_EDIT = 'You do not have permission to edit communities.';

export async function editEventsAction(_prev: EventsState, form: FormData): Promise<EventsState> {
  const parsed = eventsCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: NO_EDIT };
  const result = await editEvents(getRepo(), viewer, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, NO_EDIT) };
  refresh();
  return null;
}

export async function challengeAction(_prev: EventsState, form: FormData): Promise<EventsState> {
  const parsed = challengeCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer?.profile) return { message: SIGN_IN };
  const result = await challengeCommand(getRepo(), viewer, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, 'You cannot enter this challenge.') };
  refresh();
  return null;
}

export async function meetupAction(_prev: EventsState, form: FormData): Promise<EventsState> {
  const parsed = meetupCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer?.profile) return { message: SIGN_IN };
  const result = await meetupCommand(getRepo(), viewer, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, 'You cannot RSVP to this meetup.') };
  refresh();
  return null;
}
