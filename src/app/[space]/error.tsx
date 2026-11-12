'use client'; // Error boundaries must be Client Components.
import { RouteError } from '@/components/RouteStatus/RouteStatus';

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <RouteError retry={retry} />;
}
