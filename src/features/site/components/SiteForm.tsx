'use client';
// ActionForm bound to the site command action (one action for every Studio site form).
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { editSiteAction } from '../actions';

export function SiteForm(props: Omit<ActionFormProps, 'action'>) {
  return <ActionForm action={editSiteAction} done="Saved" {...props} />;
}
