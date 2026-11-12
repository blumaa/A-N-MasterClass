'use client';
// Form bound to one Server Action. Hidden fields carry ids; children are the inputs.
// Deterministic: no optimistic UI, the page refreshes from the server after the action.
// Errors show inline beside the inputs; success shows as a toast (returned message, else `done`).
import { useActionState, type FormEvent, type ReactNode } from 'react';
import { Button, Text, useToast } from '@/components/ui/mds';
import styles from './ActionForm.module.css';

/** A message is an error unless ok (then a success note). */
export type ActionState = { message: string; ok?: true } | null;
export type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type ActionFormProps = {
  action: FormAction;
  fields: Record<string, string>;
  submit: string;
  children?: ReactNode;
  confirm?: string;
  /** Default: primary for a stacked form with inputs (an edit form's save), else secondary. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  inline?: boolean;
  /** Toast shown when the action succeeds without a message. Omit for self-evident actions. */
  done?: string;
};

export function ActionForm({ action, fields, submit, children, confirm, variant, inline = false, done }: ActionFormProps) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const next = await action(prev, form);
    const success = next === null ? done : next.ok ? next.message : undefined;
    if (success) toast({ title: success, tone: 'success' });
    return next;
  }, null);
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
        <Button type="submit" variant={variant ?? (children && !inline ? 'primary' : 'secondary')} size="sm" loading={pending}>
          {submit}
        </Button>
      </div>
      {state && !state.ok ? (
        <Text role="alert" tone="danger" variant="note">
          {state.message}
        </Text>
      ) : null}
    </form>
  );
}
