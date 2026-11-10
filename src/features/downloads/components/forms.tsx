'use client';
// ActionForm bound to the download studio action.
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { editDownloadsAction } from '../actions';

export function DownloadForm(props: Omit<ActionFormProps, 'action'>) {
  return <ActionForm action={editDownloadsAction} {...props} />;
}
