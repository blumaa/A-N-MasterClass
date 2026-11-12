import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionForm } from './ActionForm';

describe('ActionForm', () => {
  it('posts hidden fields and shows the returned message', async () => {
    const action = vi.fn(async (_prev: unknown, form: FormData) => ({ message: `got ${form.get('id')}` }));
    render(<ActionForm action={action} fields={{ id: 'p1' }} submit="Save" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('got p1');
  });

  it('shows a success message as status, not alert', async () => {
    const action = vi.fn(async () => ({ message: 'Thanks', ok: true as const }));
    render(<ActionForm action={action} fields={{}} submit="Send" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not submit when confirm is declined', async () => {
    const action = vi.fn(async () => null);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ActionForm action={action} fields={{}} submit="Delete" confirm="Sure?" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(action).not.toHaveBeenCalled();
  });
});
