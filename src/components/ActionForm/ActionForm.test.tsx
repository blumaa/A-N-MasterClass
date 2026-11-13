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

  it('asks in an in-app dialog, never the browser confirm', async () => {
    const action = vi.fn(async () => null);
    const native = vi.spyOn(window, 'confirm');
    render(<ActionForm action={action} fields={{}} submit="Delete" confirm={{ title: 'Delete this post?', description: 'Comments go too.' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this post?' });
    expect(dialog).toHaveTextContent('Comments go too.');
    expect(native).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it('does not submit when the dialog is cancelled', async () => {
    const action = vi.fn(async () => null);
    render(<ActionForm action={action} fields={{}} submit="Delete" confirm={{ title: 'Sure?' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Sure?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(action).not.toHaveBeenCalled();
  });

  it('submits once with the hidden fields when confirmed, then closes', async () => {
    const action = vi.fn(async (_prev: unknown, _form: FormData) => null);
    render(<ActionForm action={action} fields={{ id: 'p1' }} submit="Delete" confirm={{ title: 'Sure?' }} done="Deleted" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Sure?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(region()).findByText('Deleted')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][1].get('id')).toBe('p1');
  });

  it('keeps the dialog up with the reason when the action fails', async () => {
    const action = vi.fn(async () => ({ message: 'Not allowed' }));
    render(<ActionForm action={action} fields={{}} submit="Delete" confirm={{ title: 'Sure?' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Sure?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Not allowed');
  });

  it('names the way out when the action itself is a cancel', async () => {
    render(
      <ActionForm action={vi.fn(async () => null)} fields={{}} submit="Cancel session" confirm={{ title: 'Cancel this session?', cancelLabel: 'Keep session' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Keep session' })).toBeInTheDocument();
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
