'use client';
// Post / comment box with @mentions. Posts the markup as `body`; clears once the server accepts.
import { useActionState, useState } from 'react';
import { Button, Text } from '@mond-design-system/react';
import type { ActionState, FormAction } from '@/components/ActionForm/ActionForm';
import { MentionTextarea } from '@/components/mentions/MentionTextarea';
import type { MentionOption } from '@/lib/mentions/markup';
import styles from '@/components/ActionForm/ActionForm.module.css';

export type ComposerProps = {
  action: FormAction;
  fields: Record<string, string>;
  members: readonly MentionOption[];
  submit: string;
  label: string;
  placeholder?: string;
  rows?: number;
};

export function Composer({ action, fields, members, submit, label, placeholder, rows = 3 }: ComposerProps) {
  const [value, setValue] = useState('');
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result === null) setValue('');
    return result;
  }, null);
  return (
    <form action={formAction} className={styles.stacked}>
      {Object.entries(fields).map(([name, v]) => (
        <input key={name} type="hidden" name={name} value={v} />
      ))}
      <input type="hidden" name="body" value={value} />
      <MentionTextarea value={value} onChange={setValue} members={members} rows={rows} placeholder={placeholder} aria-label={label} />
      <div>
        <Button type="submit" size="sm" loading={pending} disabled={value.trim() === ''}>
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
