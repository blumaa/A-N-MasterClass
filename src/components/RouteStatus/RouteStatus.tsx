'use client';
// Route-level fallbacks for loading.tsx and error.tsx. Shared so every segment looks the same.
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
