'use client';
// Post page: the author adds photos to a post (up to the post's 10). Starts over once saved.
import { useActionState, useState } from 'react';
import type { ActionState, FormAction } from '@/components/ActionForm/ActionForm';
import { Button, Text } from '@/components/ui/mds';
import styles from '@/components/ActionForm/ActionForm.module.css';
import { CommunityFiles, type FilesState } from './CommunityFiles';

type Props = { action: FormAction; postId: string; channelId: string; room: number };

export function PhotoAdder({ action, postId, channelId, room }: Props) {
  const [round, setRound] = useState(0);
  const [files, setFiles] = useState<FilesState>({ ready: 0, busy: false });
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result === null) setRound((n) => n + 1);
    return result;
  }, null);
  return (
    <form action={formAction} className={styles.stacked}>
      <input type="hidden" name="op" value="addPostPhotos" />
      <input type="hidden" name="postId" value={postId} />
      <CommunityFiles key={round} kind="photo" target="channel" id={channelId} max={room} onChange={setFiles} />
      <div>
        <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={files.ready === 0 || files.busy}>
          Add photos
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
