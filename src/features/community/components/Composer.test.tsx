import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';

const members = [{ id: 'u1', name: 'Robin' }];

describe('Composer', () => {
  it('posts the body with hidden fields and clears after success', async () => {
    const action = vi.fn(async (_prev: unknown, form: FormData) => {
      expect(form.get('body')).toBe('hello');
      expect(form.get('channelId')).toBe('c1');
      return null;
    });
    render(<Composer action={action} fields={{ op: 'createPost', channelId: 'c1' }} members={members} submit="Post" label="New post" />);
    const box = screen.getByLabelText('New post');
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('keeps the text and shows the error when refused', async () => {
    const action = vi.fn(async () => ({ message: 'Sign in to take part.' }));
    render(<Composer action={action} fields={{}} members={members} submit="Post" label="New post" />);
    const box = screen.getByLabelText('New post');
    fireEvent.change(box, { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in to take part.');
    expect(box).toHaveValue('hi');
  });
});
