// Studio > Downloads (G18, Kajabi Downloads): download products and their files. Files upload
// straight to Storage (FileUpload); the form saves the returned path and size.
import { FileUpload } from '@/components/FileUpload/FileUpload';
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';
import { EmptyState, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import { fileType, formatBytes } from '@/lib/format/bytes';
import type { StudioDownload } from '../api/studio';
import { DownloadForm } from './forms';
import styles from './downloads.module.css';

function Download({ download: { product: p, files } }: { download: StudioDownload }) {
  return (
    <li className={styles.row}>
      <Heading level={2} variant="subtitle">
        {p.title}
      </Heading>
      <DownloadForm fields={{ op: 'updateProduct', productId: p.id }} submit="Save">
        <Field label="Title">
          <Input name="title" defaultValue={p.title} required />
        </Field>
        <Field label="Subtitle">
          <Input name="subtitle" defaultValue={p.subtitle ?? ''} />
        </Field>
        <StatusSelect value={p.status} />
      </DownloadForm>
      <Heading level={3} variant="subtitle">
        Files
      </Heading>
      <ul aria-label={`Files of ${p.title}`} className={styles.rows}>
        {files.map((f) => (
          <li key={f.id} className={styles.row}>
            <DownloadForm fields={{ op: 'renameFile', fileId: f.id }} submit="Rename">
              <Field label="File title">
                <Input name="title" defaultValue={f.title} required />
              </Field>
            </DownloadForm>
            <Text tone="muted" variant="note">{`${f.filePath} · ${fileType(f.filePath)} · ${formatBytes(f.sizeBytes)}`}</Text>
            <DownloadForm inline variant="danger" submit="Delete file" confirm={`Delete "${f.title}"?`} fields={{ op: 'deleteFile', fileId: f.id }} />
          </li>
        ))}
      </ul>
      <DownloadForm fields={{ op: 'addFile', productId: p.id }} submit="Add file">
        <div className={styles.fields}>
          <Field label="File title">
            <Input name="title" required />
          </Field>
        </div>
        <FileUpload productId={p.id} kind="download" label="Choose or drop a file" pathName="filePath" sizeName="sizeBytes" />
      </DownloadForm>
    </li>
  );
}

export function StudioDownloads({ downloads }: { downloads: StudioDownload[] }) {
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Downloads
      </Heading>
      {downloads.length === 0 ? (
        <EmptyState title="No downloads yet" />
      ) : (
        <ul aria-label="Downloads" className={styles.rows}>
          {downloads.map((d) => (
            <Download key={d.product.id} download={d} />
          ))}
        </ul>
      )}
      <DownloadForm fields={{ op: 'createDownload' }} submit="Add download">
        <Field label="Title">
          <Input name="title" required />
        </Field>
        <Field label="Slug (optional)">
          <Input name="slug" />
        </Field>
      </DownloadForm>
    </Stack>
  );
}
