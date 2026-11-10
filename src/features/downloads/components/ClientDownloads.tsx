// Buyer page of a download product (Kajabi Downloads): each file with its type and size. The link
// is a plain anchor (full navigation) to the route that checks access and redirects to a
// short-lived signed URL.
import { Heading, Link, Stack, Text } from '@/components/ui/mds';
import type { ClientDownloads as Data } from '../api/files';
import { fileHref } from '../paths';
import styles from './downloads.module.css';

export function ClientDownloads({ data }: { data: Data }) {
  const { product, hasAccess, isEditor, files } = data;
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {product.title}
        </Heading>
        {product.subtitle ? <Text tone="muted">{product.subtitle}</Text> : null}
      </Stack>
      {!hasAccess ? <Text>{isEditor ? 'Staff preview: buyers download these files.' : 'You do not have access to these downloads yet.'}</Text> : null}
      {hasAccess || isEditor ? (
        files.length === 0 ? (
          <Text tone="muted">No files yet.</Text>
        ) : (
          <ul aria-label="Files" className={styles.rows}>
            {files.map((f) => (
              <li key={f.id} className={styles.row}>
                <Link variant="standalone" href={fileHref(product.slug, f.id)}>
                  {f.title}
                </Link>
                <Text tone="muted" variant="note">{`${f.type} · ${f.size}`}</Text>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Stack>
  );
}
