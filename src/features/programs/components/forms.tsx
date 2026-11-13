'use client';
// ActionForms bound to the program actions that use the shared toast form.
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { shareCertificateAction } from '../actions';

export function ShareCertificateForm(props: Omit<ActionFormProps, 'action'>) {
  return <ActionForm action={shareCertificateAction} {...props} />;
}
