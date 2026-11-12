import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const browser = vi.hoisted(() => ({ leavePush: vi.fn() }));
vi.mock('@/lib/push/browserPush', () => browser);
vi.mock('./pushServer', () => ({ pushServer: { name: 'server' } }));
const auth = vi.hoisted(() => ({ signOutAction: vi.fn() }));
vi.mock('@/features/auth/actions', () => auth);
const report = vi.hoisted(() => vi.fn());
vi.mock('@/lib/errors/report', () => ({ reportError: report }));

const { SignOutForm } = await import('./SignOutForm');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  browser.leavePush.mockImplementation(async () => void calls.push('leave'));
  auth.signOutAction.mockImplementation(async () => void calls.push('signOut'));
});

async function signOut() {
  render(<SignOutForm />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })));
}

describe('SignOutForm', () => {
  it("removes this browser's push while still signed in, then signs out", async () => {
    await signOut();
    expect(browser.leavePush).toHaveBeenCalledWith({ name: 'server' });
    expect(calls).toEqual(['leave', 'signOut']);
  });

  it('still signs out when push cleanup fails, and reports it', async () => {
    const failure = new Error('offline');
    browser.leavePush.mockRejectedValue(failure);
    await signOut();
    expect(report).toHaveBeenCalledWith(failure);
    expect(auth.signOutAction).toHaveBeenCalled();
  });
});
