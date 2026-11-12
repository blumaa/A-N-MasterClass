import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionForm } from './ActionForm';

const region = () => screen.getByRole('region', { name: 'Status messages' });

describe('ActionForm', () => {
  it('posts hidden fields and shows an error inline', async () => {
    const action = vi.fn(async (_prev: unknown, form: FormData) => ({ message: `got ${form.get('id')}` }));
    render(<ActionForm action={action} fields={{ id: 'p1' }} submit="Save" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('got p1');
  });

  it('shows a returned success message as a toast', async () => {
    const action = vi.fn(async () => ({ message: 'Thanks', ok: true as const }));
    render(<ActionForm action={action} fields={{}} submit="Send" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await within(region()).findByText('Thanks')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('toasts the done message when the action succeeds silently', async () => {
    const action = vi.fn(async () => null);
    render(<ActionForm action={action} fields={{}} submit="Save" done="Saved" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(region()).findByText('Saved')).toBeInTheDocument();
  });

  it('stays quiet on silent success without a done message', async () => {
    const action = vi.fn(async () => null);
    render(<ActionForm action={action} fields={{}} submit="Like" />);
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    expect(within(region()).queryByText(/./)).toBeNull();
  });

  it('does not submit when confirm is declined', async () => {
    const action = vi.fn(async () => null);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ActionForm action={action} fields={{}} submit="Delete" confirm="Sure?" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(action).not.toHaveBeenCalled();
  });

  it('makes the submit of a stacked form with inputs the main button', () => {
    const action = vi.fn(async () => null);
    render(
      <ActionForm action={action} fields={{}} submit="Save">
        <input name="title" aria-label="Title" />
      </ActionForm>,
    );
    expect(screen.getByRole('button', { name: 'Save' }).className).toMatch(/primary/);
  });

  it('keeps inline and input-less forms secondary', () => {
    const action = vi.fn(async () => null);
    render(
      <>
        <ActionForm action={action} fields={{}} submit="Add" inline>
          <input name="title" aria-label="Title" />
        </ActionForm>
        <ActionForm action={action} fields={{}} submit="Hide" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Add' }).className).not.toMatch(/primary/);
    expect(screen.getByRole('button', { name: 'Hide' }).className).not.toMatch(/primary/);
  });

  it('shows an icon-only button named by the submit text', () => {
    render(<ActionForm action={vi.fn(async () => null)} fields={{}} submit="Move up" icon="arrow-up" inline />);
    const button = screen.getByRole('button', { name: 'Move up' });
    expect(button).not.toHaveTextContent('Move up');
  });
});
