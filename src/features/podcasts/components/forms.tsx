'use client';
// ActionForms bound to the podcast actions (Studio edits, the listener's feed reset).
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { editPodcastsAction, resetFeedAction } from '../actions';

type Props = Omit<ActionFormProps, 'action'>;

export function PodcastForm(props: Props) {
  return <ActionForm action={editPodcastsAction} done="Saved" {...props} />;
}

export function ResetFeedForm(props: Props) {
  return <ActionForm action={resetFeedAction} done="Feed link reset" {...props} />;
}
