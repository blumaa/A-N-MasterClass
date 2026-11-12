'use client';
// Post / comment / chat box with @mentions. Posts the markup as `body`; clears once the server accepts.
// With `files`, photos (posts) or one attachment (chat) ride along as hidden fields; a chat line
// may be a file alone, a post still needs text.
import { useActionState, useState } from 'react';
import { Button, Text } from '@mond-design-system/react';
import type { ActionState, FormAction } from '@/components/ActionForm/ActionForm';
import { MentionTextarea } from '@/components/mentions/MentionTextarea';
import type { MentionOption } from '@/lib/mentions/markup';
import styles from '@/components/ActionForm/ActionForm.module.css';
import { CommunityFiles, type CommunityFilesProps, type FilesState } from './CommunityFiles';

export type ComposerFiles = Omit<CommunityFilesProps, 'onChange'>;

export type ComposerProps = {
  action: FormAction;
  fields: Record<string, string>;
  members: readonly MentionOption[];
  submit: string;
  label: string;
  placeholder?: string;
  rows?: number;
  files?: ComposerFiles;
};

const NO_FILES: FilesState = { ready: 0, busy: false };

export function Composer({ action, fields, members, submit, label, placeholder, rows = 3, files }: ComposerProps) {
  const [value, setValue] = useState('');
  const [round, setRound] = useState(0);
  const [attached, setAttached] = useState(NO_FILES);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result === null) {
      setValue('');
      setRound((n) => n + 1);
    }
    return result;
  }, null);
  const fileOnly = files?.kind === 'attachment' && attached.ready > 0;
  const empty = value.trim() === '' && !fileOnly;
  return (
    <form action={formAction} className={styles.stacked}>
      {Object.entries(fields).map(([name, v]) => (
        <input key={name} type="hidden" name={name} value={v} />
      ))}
      <input type="hidden" name="body" value={value} />
      <MentionTextarea value={value} onChange={setValue} members={members} rows={rows} placeholder={placeholder} aria-label={label} />
      {files ? <CommunityFiles key={round} {...files} onChange={setAttached} /> : null}
      <div>
        <Button type="submit" size="sm" loading={pending} disabled={empty || attached.busy}>
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
