'use client';
// Route-level fallbacks for loading.tsx, error.tsx and not-found.tsx. Shared so every segment looks the same.
import { ButtonLink } from '@/components/ui/links';
import { Button, EmptyState, Spinner } from '@/components/ui/mds';
import styles from './RouteStatus.module.css';

export function RouteLoading() {
  return (
    <div className={styles.center}>
      <Spinner size={32} label="Loading page" />
    </div>
  );
}

export function RouteError({ retry }: { retry: () => void }) {
  return (
    <div className={styles.center}>
      <EmptyState
        level={1}
        title="Something went wrong"
        description="This page could not be loaded. Please try again."
        action={
          <Button type="button" onClick={retry}>
            Try again
          </Button>
        }
      />
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className={styles.center}>
      <EmptyState
        level={1}
        title="Page not found"
        description="This page does not exist or is not open to you."
        action={<ButtonLink href="/">Go to the home page</ButtonLink>}
      />
    </div>
  );
}
