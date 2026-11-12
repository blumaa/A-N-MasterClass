import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpsellCard } from './UpsellCard';

const upsell = { slug: 'vip', title: 'VIP', description: 'Live calls', priceCents: 9900, currency: 'EUR' as const };

describe('UpsellCard', () => {
  it('offers the upsell with a yes link to its checkout and a no-thanks link', () => {
    render(<UpsellCard upsell={upsell} locale="en" declineHref="/library" />);
    expect(screen.getByRole('heading', { name: 'VIP' })).toBeInTheDocument();
    expect(screen.getByText('Live calls')).toBeInTheDocument();
    expect(screen.getByText('€99.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Yes, add VIP/ })).toHaveAttribute('href', '/checkout/vip');
    expect(screen.getByRole('link', { name: 'No thanks' })).toHaveAttribute('href', '/library');
  });
});
