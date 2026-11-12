'use client';
// ActionForm bound to the studio challenge + meetup action.
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { editEventsAction } from '../eventsActions';

export function EventsForm(props: Omit<ActionFormProps, 'action'>) {
  return <ActionForm action={editEventsAction} done="Saved" {...props} />;
}
