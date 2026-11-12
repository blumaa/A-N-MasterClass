import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { putFile } from '@/lib/storage/putFile';
import { requestImageUploadAction } from './actions';
import { ImageUpload } from './ImageUpload';

vi.mock('./actions', () => ({ requestImageUploadAction: vi.fn() }));
vi.mock('@/lib/storage/putFile', () => ({ putFile: vi.fn() }));

const ticket = vi.mocked(requestImageUploadAction);
const put = vi.mocked(putFile);

beforeEach(() => {
  ticket.mockReset();
  put.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

const hidden = () => document.querySelector<HTMLInputElement>('input[type=hidden][name="f.image"]')!.value;
const pick = (file: File) => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });

function renderUpload(current?: { path: string; src: string }) {
  render(<form><ImageUpload name="f.image" label="Image" current={current} /></form>);
}

describe('ImageUpload', () => {
  it('uploads the picked image and stores its path in the hidden input', async () => {
    ticket.mockResolvedValue({ ok: true, uploadUrl: 'https://up.test/x', path: 's/site/u-a.jpg' });
    put.mockResolvedValue(undefined);
    renderUpload();
    expect(document.querySelector('input[type=file]')).not.toHaveAttribute('name');
    const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' });
    pick(file);
    await waitFor(() => expect(hidden()).toBe('s/site/u-a.jpg'));
    expect(ticket).toHaveBeenCalledWith('site', { fileName: 'a.jpg', sizeBytes: 3 });
    expect(put).toHaveBeenCalledWith('https://up.test/x', file, expect.any(Function));
    expect(screen.getByRole('img', { name: 'Image preview' })).toHaveAttribute('src', 'blob:preview');
  });

  it('asks for an avatar ticket when the field is a member photo', async () => {
    ticket.mockResolvedValue({ ok: false, message: 'No.' });
    render(<form><ImageUpload name="avatarPath" label="Photo" target="avatar" /></form>);
    pick(new File(['abc'], 'me.png'));
    await waitFor(() => expect(ticket).toHaveBeenCalledWith('avatar', { fileName: 'me.png', sizeBytes: 3 }));
  });

  it('shows the current image and can remove it', () => {
    renderUpload({ path: 's/site/old.jpg', src: 'https://cdn.test/old.jpg' });
    expect(hidden()).toBe('s/site/old.jpg');
    expect(screen.getByRole('img', { name: 'Image preview' })).toHaveAttribute('src', 'https://cdn.test/old.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(hidden()).toBe('');
    expect(screen.queryByRole('img', { name: 'Image preview' })).not.toBeInTheDocument();
  });

  it('shows a refusal and keeps the current image', async () => {
    ticket.mockResolvedValue({ ok: false, message: 'Use a JPG, PNG or WebP image.' });
    renderUpload({ path: 's/site/old.jpg', src: 'https://cdn.test/old.jpg' });
    pick(new File(['x'], 'a.gif'));
    expect(await screen.findByText('Use a JPG, PNG or WebP image.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    expect(hidden()).toBe('s/site/old.jpg');
  });
});
