'use client';
// ActionForm bound to the studio community command action (one action for every form).
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { editCommunityAction } from '../actions';

export function CommunityForm(props: Omit<ActionFormProps, 'action'>) {
  return <ActionForm action={editCommunityAction} done="Saved" {...props} />;
}
