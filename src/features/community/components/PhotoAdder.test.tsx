import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FilesState } from './CommunityFiles';
import { PhotoAdder } from './PhotoAdder';

let report: (state: FilesState) => void = () => {};
const mounts = vi.fn();
vi.mock('./CommunityFiles', () => ({
  CommunityFiles: ({ onChange, max, id }: { onChange: (state: FilesState) => void; max: number; id: string }) => {
    report = onChange;
    mounts(max, id);
    return <input type="hidden" name="photo" value="p" />;
  },
}));

describe('PhotoAdder', () => {
  it('adds the uploaded photos to the post, then starts over', async () => {
    const action = vi.fn(async (_prev: unknown, form: FormData) => {
      expect(form.get('op')).toBe('addPostPhotos');
      expect(form.get('postId')).toBe('p1');
      expect(form.getAll('photo')).toEqual(['p']);
      return null;
    });
    render(<PhotoAdder action={action} postId="p1" channelId="ch" room={7} />);
    expect(mounts).toHaveBeenLastCalledWith(7, 'ch');
    const add = screen.getByRole('button', { name: 'Add photos' });
    expect(add).toBeDisabled();
    act(() => report({ ready: 1, busy: true }));
    expect(add).toBeDisabled();
    act(() => report({ ready: 1, busy: false }));
    fireEvent.click(add);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });
});
