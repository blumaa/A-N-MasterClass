import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsSettings } from './PaymentsSettings';

vi.mock('../../studioActions', () => ({ editOfferAction: vi.fn(), savePaymentsAction: vi.fn() }));

const NOW = new Date('2026-11-10T12:00:00Z');

describe('PaymentsSettings', () => {
  it('shows a form per env, the active env and the webhook URL', () => {
    render(
      <PaymentsSettings
        view={{ sandbox: { clientId: 'cid', webhookId: null, hasSecret: true, updatedAt: NOW }, live: null }}
        activeEnv="sandbox"
        webhookUrl="https://alexander.example/api/payments/paypal/alexander"
      />,
    );
    const sandbox = screen.getByRole('region', { name: /Sandbox/ });
    expect(within(sandbox).getByLabelText('Client ID')).toHaveValue('cid');
    expect(within(sandbox).getByLabelText('Secret')).toHaveValue('');
    expect(within(sandbox).getByText(/stored/i)).toBeInTheDocument();
    expect(within(sandbox).getByText('In use')).toBeInTheDocument();
    const live = screen.getByRole('region', { name: /Live/ });
    expect(within(live).getByLabelText('Secret')).toBeRequired();
    expect(screen.getAllByText('https://alexander.example/api/payments/paypal/alexander').length).toBeGreaterThan(0);
  });
});
