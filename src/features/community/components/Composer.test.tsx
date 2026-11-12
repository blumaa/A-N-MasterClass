import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FilesState } from './CommunityFiles';
import { Composer } from './Composer';

let report: (state: FilesState) => void = () => {};
vi.mock('./CommunityFiles', () => ({
  CommunityFiles: ({ onChange }: { onChange: (state: FilesState) => void }) => {
    report = onChange;
    return <input type="hidden" name="attachmentPath" value="p" />;
  },
}));

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

  it('chat: sends a file without text, but not while the file is uploading', async () => {
    const action = vi.fn(async () => null);
    render(
      <Composer action={action} fields={{}} members={members} submit="Send" label="Message" files={{ kind: 'attachment', target: 'channel', id: 'c1', max: 1 }} />,
    );
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    act(() => report({ ready: 0, busy: true }));
    expect(send).toBeDisabled();
    act(() => report({ ready: 1, busy: false }));
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });

  it('posts still need text when photos are attached', () => {
    render(
      <Composer action={vi.fn()} fields={{}} members={members} submit="Post" label="New post" files={{ kind: 'photo', target: 'channel', id: 'c1', max: 10 }} />,
    );
    act(() => report({ ready: 2, busy: false }));
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
  });

  it('reports typing on each edit and stops on blur and after a send', async () => {
    const onType = vi.fn();
    const onStop = vi.fn();
    const action = vi.fn(async () => null);
    render(<Composer action={action} fields={{}} members={members} submit="Send" label="Message" onType={onType} onStop={onStop} />);
    const box = screen.getByLabelText('Message');
    fireEvent.change(box, { target: { value: 'h' } });
    fireEvent.change(box, { target: { value: 'hi' } });
    expect(onType).toHaveBeenCalledTimes(2);
    fireEvent.blur(box);
    expect(onStop).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onStop).toHaveBeenCalledTimes(2));
  });

  it('clearing the box stops typing instead of reporting it', () => {
    const onType = vi.fn();
    const onStop = vi.fn();
    render(<Composer action={vi.fn()} fields={{}} members={members} submit="Send" label="Message" onType={onType} onStop={onStop} />);
    const box = screen.getByLabelText('Message');
    fireEvent.change(box, { target: { value: 'h' } });
    fireEvent.change(box, { target: { value: '' } });
    expect(onType).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
  });
});
