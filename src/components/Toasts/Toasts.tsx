'use client';
// One toast region for the whole app. Mounted in the root layout so every route and portal
// shares it; components call useToast from the mds boundary.
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/mds';

export function Toasts({ children }: { children: ReactNode }) {
  return (
    <ToastProvider regionLabel="Status messages" dismissLabel="Dismiss">
      {children}
    </ToastProvider>
  );
}
