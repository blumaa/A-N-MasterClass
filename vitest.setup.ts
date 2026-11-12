// jest-dom matchers for jsdom tests. Unmount trees after each test.
// Every render sits in the app's toast region, as the root layout does in the app.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Toasts } from '@/components/Toasts/Toasts';

vi.mock('@testing-library/react', async (importOriginal) => {
  const rtl = await importOriginal<typeof import('@testing-library/react')>();
  // Mirrors the root layout: every screen renders under the toast provider.
  const render = ((ui: ReactElement, options?: RenderOptions) => rtl.render(ui, { wrapper: Toasts, ...options })) as typeof rtl.render;
  return { ...rtl, render };
});

afterEach(() => {
  cleanup();
});
