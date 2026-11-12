'use client';
// Studio image field for site sections and the logo. Same flow as FileUpload: signed ticket,
// bytes straight to Storage, stored path into one hidden input. Shows a preview and a remove button.
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button, FileDrop, Text, UploadProgress, type UploadStatus } from '@/components/ui/mds';
import { formatBytes } from '@/lib/format/bytes';
import { putFile } from '@/lib/storage/putFile';
import { SITE_IMAGE_ACCEPT, SITE_IMAGE_MAX_BYTES } from '@/lib/storage/siteImages';
import { requestImageUploadAction } from './actions';
import styles from './ImageUpload.module.css';

export type CurrentImage = { path: string; src: string };

export type ImageUploadProps = {
  /** Hidden input name the form command reads. */
  name: string;
  label: string;
  current?: CurrentImage;
};

type Upload = { file: File; status: UploadStatus; percent: number; error?: string };

const LABELS = {
  uploading: 'Uploading',
  processing: 'Processing',
  done: 'Uploaded',
  error: 'Upload failed',
  cancel: 'Cancel',
  retry: 'Retry',
  remove: 'Dismiss',
};

const HINT = `JPG, PNG or WebP. Up to ${formatBytes(SITE_IMAGE_MAX_BYTES)}.`;

export function ImageUpload({ name, label, current }: ImageUploadProps) {
  const [image, setImage] = useState<CurrentImage | null>(current ?? null);
  const [upload, setUpload] = useState<Upload | null>(null);

  useEffect(() => () => {
    if (image?.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
  }, [image]);

  async function send(file: File) {
    const update = (next: Partial<Upload>) => setUpload((u) => (u?.file === file ? { ...u, ...next } : u));
    setUpload({ file, status: 'uploading', percent: 0 });
    const ticket = await requestImageUploadAction({ fileName: file.name, sizeBytes: file.size });
    if (!ticket.ok) return update({ status: 'error', error: ticket.message });
    try {
      await putFile(ticket.uploadUrl, file, (percent) => update({ percent }));
      update({ status: 'done', percent: 100 });
      setImage({ path: ticket.path, src: URL.createObjectURL(file) });
    } catch (error) {
      update({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  const busy = upload?.status === 'uploading';
  return (
    <div className={styles.upload}>
      <input type="hidden" name={name} value={image?.path ?? ''} />
      <Text variant="label">{label}</Text>
      {image ? (
        <div className={styles.preview}>
          <div className={styles.frame}>
            <Image src={image.src} alt="Image preview" fill unoptimized sizes="12rem" className={styles.image} />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)} disabled={busy}>
            Remove image
          </Button>
        </div>
      ) : null}
      <FileDrop
        label={image ? 'Replace image' : 'Choose an image'}
        hint={HINT}
        accept={SITE_IMAGE_ACCEPT}
        disabled={busy}
        onFiles={([file]) => void send(file)}
      />
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
