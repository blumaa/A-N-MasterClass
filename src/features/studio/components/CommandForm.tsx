'use client';
// Form for one curriculum command. Hidden fields carry op + ids; children are the inputs.
// Deterministic: no optimistic UI, the page refreshes from the server after the action.
import { useActionState, type FormEvent, type ReactNode } from 'react';
import { Button, Text } from '@mond-design-system/react';
import { editCurriculumAction } from '../actions';
import styles from './CommandForm.module.css';

type Props = {
  fields: Record<string, string>;
  submit: string;
  children?: ReactNode;
  confirm?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  inline?: boolean;
};

export function CommandForm({ fields, submit, children, confirm, variant = 'secondary', inline = false }: Props) {
  const [state, action, pending] = useActionState(editCurriculumAction, null);
  const onSubmit = (event: FormEvent) => {
    if (confirm && !window.confirm(confirm)) event.preventDefault();
  };
  return (
    <form action={action} onSubmit={onSubmit} className={inline ? styles.inline : styles.stacked}>
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
