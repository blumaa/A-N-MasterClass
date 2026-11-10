'use client';
// ActionForms bound to the coaching actions (Studio edits, client bookings).
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { bookingAction, editCoachingAction } from '../actions';

type Props = Omit<ActionFormProps, 'action'>;

export function CoachingForm(props: Props) {
  return <ActionForm action={editCoachingAction} {...props} />;
}

export function BookingForm(props: Props) {
  return <ActionForm action={bookingAction} {...props} />;
}
