import { Fragment } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const browser = vi.hoisted(() => ({ currentAvailability: vi.fn(), heal: vi.fn(), dropPush: vi.fn() }));
vi.mock('@/lib/push/browserPush', () => browser);
vi.mock('./pushServer', () => ({ pushServer: { name: 'server' } }));
const report = vi.hoisted(() => vi.fn());
vi.mock('@/lib/errors/report', () => ({ reportError: report }));

const { PushHeal } = await import('./PushHeal');

beforeEach(() => {
  vi.clearAllMocks();
  browser.heal.mockResolvedValue(undefined);
  browser.dropPush.mockResolvedValue(undefined);
});

describe('PushHeal', () => {
  it('heals once for the signed-in account, reporting a failure', async () => {
    browser.currentAvailability.mockReturnValue('ready');
    const failure = new Error('offline');
    browser.heal.mockRejectedValue(failure);
    const { container } = render(<PushHeal publicKey="pub" profileId="p1" />, { wrapper: Fragment });
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(browser.heal).toHaveBeenCalledWith({ name: 'server' }, 'pub', 'p1');
    expect(report).toHaveBeenCalledWith(failure);
  });

  it('never re-subscribes a signed-out visitor: drops what the last account left', async () => {
    browser.currentAvailability.mockReturnValue('ready');
    render(<PushHeal publicKey="pub" profileId={null} />);
    await act(async () => {});
    expect(browser.heal).not.toHaveBeenCalled();
    expect(browser.dropPush).toHaveBeenCalled();
  });

  it('does nothing where push cannot work', async () => {
    browser.currentAvailability.mockReturnValue('install');
    render(<PushHeal publicKey="pub" profileId="p1" />, { wrapper: Fragment });
    await act(async () => {});
    expect(browser.heal).not.toHaveBeenCalled();
    expect(browser.dropPush).not.toHaveBeenCalled();
  });
});
