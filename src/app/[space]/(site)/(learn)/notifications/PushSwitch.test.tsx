import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushAvailability } from '@/lib/push/availability';

const browser = vi.hoisted(() => ({
  currentAvailability: vi.fn<() => PushAvailability>(),
  isSubscribed: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock('@/lib/push/browserPush', () => browser);
vi.mock('../../../pushServer', () => ({ pushServer: { name: 'server' } }));

const { PushSwitch } = await import('./PushSwitch');

beforeEach(() => {
  vi.clearAllMocks();
  browser.currentAvailability.mockReturnValue('ready');
  browser.isSubscribed.mockResolvedValue(false);
  browser.subscribe.mockResolvedValue(undefined);
  browser.unsubscribe.mockResolvedValue(undefined);
});

async function renderSwitch() {
  render(<PushSwitch publicKey="pub" />);
  await act(async () => {});
}

describe('PushSwitch', () => {
  it('turns push on for this device', async () => {
    await renderSwitch();
    const toggle = screen.getByRole('switch', { name: 'Push notifications on this device' });
    expect(toggle).not.toBeChecked();
    await act(async () => fireEvent.click(toggle));
    expect(browser.subscribe).toHaveBeenCalledWith({ name: 'server' }, 'pub');
    expect(toggle).toBeChecked();
  });

  it('turns it off', async () => {
    browser.isSubscribed.mockResolvedValue(true);
    await renderSwitch();
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
    await act(async () => fireEvent.click(toggle));
    expect(browser.unsubscribe).toHaveBeenCalledWith({ name: 'server' });
    expect(toggle).not.toBeChecked();
  });

  it('says why turning on failed and stays off', async () => {
    browser.subscribe.mockRejectedValue(new Error('Notifications are blocked for this site in your browser settings.'));
    await renderSwitch();
    await act(async () => fireEvent.click(screen.getByRole('switch')));
    expect(screen.getByRole('alert')).toHaveTextContent('Notifications are blocked');
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('tells iPhone users to add the app to the Home Screen instead of showing a switch', async () => {
    browser.currentAvailability.mockReturnValue('install');
    await renderSwitch();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(browser.isSubscribed).not.toHaveBeenCalled();
  });

  it('explains unsupported and blocked browsers', async () => {
    browser.currentAvailability.mockReturnValue('unsupported');
    await renderSwitch();
    expect(screen.getByText(/cannot get push notifications/)).toBeInTheDocument();
  });

  it('explains blocked notifications', async () => {
    browser.currentAvailability.mockReturnValue('blocked');
    await renderSwitch();
    expect(screen.getByText(/blocked for this site/)).toBeInTheDocument();
  });
});
