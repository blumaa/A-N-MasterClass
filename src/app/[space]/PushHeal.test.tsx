import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const browser = vi.hoisted(() => ({ currentAvailability: vi.fn(), heal: vi.fn() }));
vi.mock('@/lib/push/browserPush', () => browser);
vi.mock('./pushServer', () => ({ pushServer: { name: 'server' } }));
const report = vi.hoisted(() => vi.fn());
vi.mock('@/lib/errors/report', () => ({ reportError: report }));

const { PushHeal } = await import('./PushHeal');

describe('PushHeal', () => {
  it('heals once on a browser that can get push, reporting a failure', async () => {
    browser.currentAvailability.mockReturnValue('ready');
    const failure = new Error('offline');
    browser.heal.mockRejectedValue(failure);
    const { container } = render(<PushHeal publicKey="pub" />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(browser.heal).toHaveBeenCalledWith({ name: 'server' }, 'pub');
    expect(report).toHaveBeenCalledWith(failure);
  });

  it('does nothing where push cannot work', async () => {
    browser.heal.mockClear();
    browser.currentAvailability.mockReturnValue('install');
    render(<PushHeal publicKey="pub" />);
    await act(async () => {});
    expect(browser.heal).not.toHaveBeenCalled();
  });
});
