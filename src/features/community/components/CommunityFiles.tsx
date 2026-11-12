'use client';
// Files on a post or chat line (G0, Kajabi: photos in posts, a file in chat). Each pick gets an
// upload ticket, goes straight to Storage, then lands in hidden fields for the surrounding form.
// Photos are resized in the browser first. The picker has no name, so no bytes ride the action.
import { useEffect, useEffectEvent, useState } from 'react';
import { FileDrop, Text, UploadProgress, type UploadStatus } from '@/components/ui/mds';
import { formatBytes } from '@/lib/format/bytes';
import { preparePhoto } from '@/lib/photo/photo';
import { ATTACHMENT_TYPES, COMMUNITY_MAX_BYTES, PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/storage/communityFiles';
import { putFile } from '@/lib/storage/putFile';
import { communityUploadAction } from '../uploadActions';
import styles from './community.module.css';

export type FilesState = { ready: number; busy: boolean };

export type CommunityFilesProps = {
  kind: 'photo' | 'attachment';
  target: 'channel' | 'thread';
  /** Channel id or DM thread id. */
  id: string;
  /** How many may be added (photos: what is left of the post's 10). */
  max: number;
  onChange: (state: FilesState) => void;
};

type Stored = { path: string; name: string; type: string; size: number };
type Upload = { key: number; file: File; status: UploadStatus; percent: number; error?: string; stored?: Stored };

const LABELS = {
  uploading: 'Uploading',
  processing: 'Resizing',
  done: 'Uploaded',
  error: 'Upload failed',
  cancel: 'Cancel',
  retry: 'Retry',
  remove: 'Remove',
};

const RULES = {
  photo: { label: 'Add photos', hint: `JPEG, PNG, WebP or GIF. Up to ${formatBytes(PHOTO_MAX_BYTES)} each.`, accept: PHOTO_TYPES.join(',') },
  attachment: { label: 'Attach a file', hint: `Up to ${formatBytes(COMMUNITY_MAX_BYTES)}.`, accept: ATTACHMENT_TYPES.join(',') },
};

let nextKey = 0;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function CommunityFiles({ kind, target, id, max, onChange }: CommunityFilesProps) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const ready = uploads.filter((u) => u.stored).length;
  const busy = uploads.some((u) => u.status === 'uploading' || u.status === 'processing');
  const report = useEffectEvent(onChange);
  useEffect(() => report({ ready, busy }), [ready, busy]);

  async function send(key: number, picked: File) {
    const update = (next: Partial<Upload>) => setUploads((all) => all.map((u) => (u.key === key ? { ...u, ...next } : u)));
    try {
      update({ status: kind === 'photo' ? 'processing' : 'uploading', percent: 0, error: undefined });
      const file = kind === 'photo' ? await preparePhoto(picked) : picked;
      update({ status: 'uploading' });
      const ticket = await communityUploadAction({ target, id, fileName: file.name, type: file.type, sizeBytes: file.size });
      if (!ticket.ok) return update({ status: 'error', error: ticket.message });
      await putFile(ticket.uploadUrl, file, (percent) => update({ percent }));
      update({ status: 'done', percent: 100, stored: { path: ticket.path, name: file.name, type: file.type, size: file.size } });
    } catch (error) {
      update({ status: 'error', error: message(error) });
    }
  }

  function add(files: File[]) {
    const kept = kind === 'attachment' ? [] : uploads;
    const room = Math.max(0, max - kept.length);
    setNotice(files.length > room ? `Up to ${max} ${max === 1 ? 'photo' : 'photos'} per post.` : null);
    const fresh = files.slice(0, room).map((file): Upload => ({ key: nextKey++, file, status: 'uploading', percent: 0 }));
    setUploads([...kept, ...fresh]);
    for (const u of fresh) void send(u.key, u.file);
  }

  return (
    <div className={styles.files}>
      {uploads.map(({ key, stored }) =>
        !stored ? null : kind === 'photo' ? (
          <input key={key} type="hidden" name="photo" value={stored.path} />
        ) : (
          <span key={key}>
            <input type="hidden" name="attachmentPath" value={stored.path} />
            <input type="hidden" name="attachmentName" value={stored.name} />
            <input type="hidden" name="attachmentType" value={stored.type} />
            <input type="hidden" name="attachmentSize" value={String(stored.size)} />
          </span>
        ),
      )}
      <FileDrop {...RULES[kind]} multiple={kind === 'photo'} disabled={busy} onFiles={add} />
      {notice ? <Text tone="muted" variant="note">{notice}</Text> : null}
      {uploads.map((u) => (
        <UploadProgress
          key={u.key}
          name={u.file.name}
          labels={LABELS}
          status={u.status}
          value={u.percent}
          error={u.error}
          onRetry={u.status === 'error' ? () => void send(u.key, u.file) : undefined}
          onRemove={u.status === 'done' || u.status === 'error' ? () => setUploads((all) => all.filter((x) => x.key !== u.key)) : undefined}
        />
      ))}
    </div>
  );
}
