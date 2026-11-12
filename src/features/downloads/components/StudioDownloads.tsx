// Studio > Downloads (G18, Kajabi Downloads): download products and their files. Files upload
// straight to Storage (FileUpload); the form saves the returned path and size.
import { FileUpload } from '@/components/FileUpload/FileUpload';
import { ProductFields, type ImageSrc } from '@/components/ProductFields/ProductFields';
import { EmptyState, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import { fileType, formatBytes } from '@/lib/format/bytes';
import type { StudioDownload } from '../api/studio';
import { DownloadForm } from './forms';
import styles from './downloads.module.css';

function Download({ download: { product: p, files }, imageSrc }: { download: StudioDownload; imageSrc: ImageSrc }) {
  return (
    <li className={styles.product}>
      <Heading level={2} variant="subtitle">
        {p.title}
      </Heading>
      <DownloadForm fields={{ op: 'updateProduct', productId: p.id }} submit="Save">
        <ProductFields product={p} imageSrc={imageSrc} />
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
            <DownloadForm inline variant="ghost" submit="Delete file" confirm={`Delete "${f.title}"?`} fields={{ op: 'deleteFile', fileId: f.id }} />
          </li>
        ))}
      </ul>
      <Heading level={3} variant="label">
        New file
      </Heading>
      <DownloadForm fields={{ op: 'addFile', productId: p.id }} submit="Add file">
        <Field label="File title">
          <Input name="title" required />
        </Field>
        <FileUpload productId={p.id} kind="download" label="Choose or drop a file" pathName="filePath" sizeName="sizeBytes" />
      </DownloadForm>
    </li>
  );
}

export function StudioDownloads({ downloads, imageSrc }: { downloads: StudioDownload[]; imageSrc: ImageSrc }) {
  return (
    <Stack gap="loose">
      {downloads.length === 0 ? (
        <EmptyState title="No downloads yet" />
      ) : (
        <ul aria-label="Downloads" className={styles.rows}>
          {downloads.map((d) => (
            <Download key={d.product.id} download={d} imageSrc={imageSrc} />
          ))}
        </ul>
      )}
      <Heading level={2} variant="label">
        New download
      </Heading>
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
