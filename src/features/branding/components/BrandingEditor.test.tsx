import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { BrandingEditor } from './BrandingEditor';

const action = vi.fn(async () => null);

describe('BrandingEditor', () => {
  it('previews colours live and blocks saving while contrast fails', () => {
    const { container } = render(<BrandingEditor action={action} colors={DEFAULT_BRAND} fonts={{ heading: null, body: null }} />);
    const save = screen.getByRole('button', { name: 'Save branding' });
    expect(save).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.change(screen.getByLabelText('Text'), { target: { value: '#cccccc' } });

    expect(screen.getByRole('alert')).toHaveTextContent('--mds-text-primary');
    expect(save).toBeDisabled();
    const preview = container.querySelector<HTMLElement>('[data-preview]')!;
    expect(preview.style.getPropertyValue('--mds-text-primary')).toBe('#cccccc');
  });

  it('offers font selects for a space, none for a program override', () => {
    render(<BrandingEditor action={action} colors={DEFAULT_BRAND} fonts={{ heading: 'lora', body: null }} />);
    expect(screen.getByLabelText('Heading font')).toHaveValue('lora');
    expect(screen.getByLabelText('Body font')).toHaveValue('');
  });

  it('program mode: carries the product id, no fonts', () => {
    const { container } = render(<BrandingEditor action={action} colors={DEFAULT_BRAND} productId="prod-1" />);
    expect(screen.queryByLabelText('Heading font')).toBeNull();
    expect(container.querySelector('input[name="productId"]')).toHaveValue('prod-1');
  });

  it('toasts a save and shows a failure inline', async () => {
    const save = vi.fn(async () => ({ message: 'Saved.', saved: true }));
    render(<BrandingEditor action={save} colors={DEFAULT_BRAND} fonts={{ heading: null, body: null }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save branding' }));
    const region = screen.getByRole('region', { name: 'Status messages' });
    expect(await within(region).findByText('Saved.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a failed save as an alert', async () => {
    const fail = vi.fn(async () => ({ message: 'No permission.', saved: false }));
    render(<BrandingEditor action={fail} colors={DEFAULT_BRAND} fonts={{ heading: null, body: null }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save branding' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No permission.');
  });
});
