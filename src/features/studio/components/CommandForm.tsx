'use client';
// ActionForm bound to the curriculum command action.
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { editCurriculumAction } from '../actions';

export function CommandForm(props: Omit<ActionFormProps, 'action'>) {
  return <ActionForm action={editCurriculumAction} {...props} />;
}
