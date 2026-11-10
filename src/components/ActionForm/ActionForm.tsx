'use client';
// Form bound to one Server Action. Hidden fields carry ids; children are the inputs.
// Deterministic: no optimistic UI, the page refreshes from the server after the action.
import { useActionState, type FormEvent, type ReactNode } from 'react';
import { Button, Text } from '@/components/ui/mds';
import styles from './ActionForm.module.css';

export type ActionState = { message: string } | null;
export type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type ActionFormProps = {
  action: FormAction;
  fields: Record<string, string>;
  submit: string;
  children?: ReactNode;
  confirm?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  inline?: boolean;
};

export function ActionForm({ action, fields, submit, children, confirm, variant = 'secondary', inline = false }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const onSubmit = (event: FormEvent) => {
    if (confirm && !window.confirm(confirm)) event.preventDefault();
  };
  return (
    <form action={formAction} onSubmit={onSubmit} className={inline ? styles.inline : styles.stacked}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <div>
        <Button type="submit" variant={variant} size="sm" loading={pending}>
          {submit}
        </Button>
      </div>
      {state ? (
        <Text role="alert" tone="danger" variant="note">
          {state.message}
        </Text>
      ) : null}
    </form>
  );
}
