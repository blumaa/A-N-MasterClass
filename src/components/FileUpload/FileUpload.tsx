'use client';
// Studio file field: picks a file, gets a signed upload ticket, sends the bytes straight to Storage,
// then puts the stored path and size into hidden inputs for the surrounding form to save.
// The picker has no name, so the bytes never ride along with the Server Action.
import { useState } from 'react';
import { FileDrop, Text, UploadProgress, type UploadStatus } from '@/components/ui/mds';
import { formatBytes } from '@/lib/format/bytes';
import { putFile } from '@/lib/storage/putFile';
import { UPLOAD_RULES, type UploadKind } from '@/lib/storage/requestUpload';
import { requestUploadAction } from './actions';
import styles from './FileUpload.module.css';

export type StoredFile = { path: string; bytes: number };

export type FileUploadProps = {
  productId: string;
  kind: UploadKind;
  label: string;
  /** Hidden input names the form command reads. */
  pathName: string;
  sizeName: string;
  current?: StoredFile;
};

type Upload = { file: File; status: UploadStatus; percent: number; error?: string; stored?: StoredFile };

const LABELS = {
  uploading: 'Uploading',
  processing: 'Processing',
  done: 'Uploaded',
  error: 'Upload failed',
  cancel: 'Cancel',
  retry: 'Retry',
  remove: 'Remove',
};

const baseName = (path: string) => path.split('/').at(-1) ?? path;

function hint(kind: UploadKind): string {
  const { maxBytes, accept } = UPLOAD_RULES[kind];
  const size = `Up to ${formatBytes(maxBytes)}`;
  return accept ? `MP3 only. ${size}.` : `${size}.`;
}

export function FileUpload({ productId, kind, label, pathName, sizeName, current }: FileUploadProps) {
  const [upload, setUpload] = useState<Upload | null>(null);

  async function send(file: File) {
    const update = (next: Partial<Upload>) => setUpload((u) => (u?.file === file ? { ...u, ...next } : u));
    setUpload({ file, status: 'uploading', percent: 0 });
    const ticket = await requestUploadAction({ productId, kind, fileName: file.name, sizeBytes: file.size });
    if (!ticket.ok) return update({ status: 'error', error: ticket.message });
    try {
      await putFile(ticket.uploadUrl, file, (percent) => update({ percent }));
      update({ status: 'done', percent: 100, stored: { path: ticket.path, bytes: file.size } });
    } catch (error) {
      update({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  const saved = upload?.stored ?? current;
  const busy = upload?.status === 'uploading';
  return (
    <div className={styles.upload}>
      <input type="hidden" name={pathName} value={saved?.path ?? ''} />
      <input type="hidden" name={sizeName} value={saved ? String(saved.bytes) : ''} />
      {current ? (
        <Text tone="muted" variant="note">{`Current file: ${baseName(current.path)} · ${formatBytes(current.bytes)}`}</Text>
      ) : null}
      <FileDrop label={label} hint={hint(kind)} accept={UPLOAD_RULES[kind].accept} disabled={busy} onFiles={([file]) => void send(file)} />
      {upload ? (
        <UploadProgress
          name={upload.file.name}
          labels={LABELS}
          status={upload.status}
          value={upload.percent}
          error={upload.error}
          onRetry={upload.status === 'error' ? () => void send(upload.file) : undefined}
          onRemove={busy ? undefined : () => setUpload(null)}
        />
      ) : null}
    </div>
  );
}
