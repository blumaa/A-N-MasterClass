import { Fragment } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const tap = vi.hoisted(() => ({ takePendingTap: vi.fn() }));
vi.mock('@/lib/push/pendingTap', async (importOriginal) => ({ ...(await importOriginal<object>()), ...tap }));

const { NotificationTap } = await import('./NotificationTap');

const ORIGIN = window.location.origin;
let worker: EventTarget;

beforeEach(() => {
  vi.clearAllMocks();
  tap.takePendingTap.mockResolvedValue(null);
  worker = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', { value: worker, configurable: true });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

const message = (data: unknown) => Object.assign(new Event('message'), { data });

describe('NotificationTap', () => {
  it('routes to a tap parked while the app was closed', async () => {
    tap.takePendingTap.mockResolvedValue('/community/c/posts/p1');
    const { container } = render(<NotificationTap />, { wrapper: Fragment });
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(router.push).toHaveBeenCalledWith('/community/c/posts/p1');
  });

  it('stays put when nothing was parked', async () => {
    render(<NotificationTap />, { wrapper: Fragment });
    await act(async () => {});
    expect(router.push).not.toHaveBeenCalled();
  });

  it('routes on a navigate message from the worker, same origin only, and drains the parked copy', async () => {
    render(<NotificationTap />, { wrapper: Fragment });
    await act(async () => {});
    tap.takePendingTap.mockClear();
    act(() => {
      worker.dispatchEvent(message({ type: 'navigate', url: 'https://evil.test/x' }));
      worker.dispatchEvent(message({ type: 'other', url: `${ORIGIN}/x` }));
    });
    expect(router.push).not.toHaveBeenCalled();
    act(() => {
      worker.dispatchEvent(message({ type: 'navigate', url: `${ORIGIN}/notifications` }));
    });
    expect(router.push).toHaveBeenCalledWith('/notifications');
    expect(tap.takePendingTap).toHaveBeenCalled();
  });
});
