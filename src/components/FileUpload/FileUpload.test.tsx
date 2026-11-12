import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { putFile } from '@/lib/storage/putFile';
import { requestUploadAction } from './actions';
import { FileUpload } from './FileUpload';

vi.mock('./actions', () => ({ requestUploadAction: vi.fn() }));
vi.mock('@/lib/storage/putFile', () => ({ putFile: vi.fn() }));

const ticket = vi.mocked(requestUploadAction);
const put = vi.mocked(putFile);

beforeEach(() => {
  ticket.mockReset();
  put.mockReset();
});

const hidden = (name: string) => document.querySelector<HTMLInputElement>(`input[type=hidden][name="${name}"]`)!.value;
const picker = () => document.querySelector<HTMLInputElement>('input[type=file]')!;
const pick = (file: File) => fireEvent.change(picker(), { target: { files: [file] } });

function renderUpload(current?: { path: string; bytes: number }) {
  render(
    <form>
      <FileUpload productId="p1" kind="podcast" label="Audio file" pathName="audioPath" sizeName="audioBytes" current={current} />
    </form>,
  );
}

describe('FileUpload', () => {
  it('asks for a ticket, sends the bytes to it, then fills the hidden path and size', async () => {
    ticket.mockResolvedValue({ ok: true, uploadUrl: 'https://up.test/x', path: 's/p1/u-ep.mp3' });
    put.mockImplementation(async (_url, _file, onProgress) => onProgress(50));
    renderUpload();
    expect(picker()).not.toHaveAttribute('name');
    expect(picker()).toHaveAttribute('accept', '.mp3,audio/mpeg');
    const file = new File(['abcd'], 'Ep 1.mp3', { type: 'audio/mpeg' });
    pick(file);
    await waitFor(() => expect(hidden('audioPath')).toBe('s/p1/u-ep.mp3'));
    expect(hidden('audioBytes')).toBe('4');
    expect(ticket).toHaveBeenCalledWith({ productId: 'p1', kind: 'podcast', fileName: 'Ep 1.mp3', sizeBytes: 4 });
    expect(put).toHaveBeenCalledWith('https://up.test/x', file, expect.any(Function));
    expect(screen.getByText('Ep 1.mp3')).toBeInTheDocument();
  });

  it('shows the refusal and keeps the current file', async () => {
    ticket.mockResolvedValue({ ok: false, message: 'Podcast audio must be an .mp3 file.' });
    renderUpload({ path: 's/p1/old.mp3', bytes: 9 });
    pick(new File(['x'], 'a.mp3'));
    expect(await screen.findByText('Podcast audio must be an .mp3 file.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    expect(hidden('audioPath')).toBe('s/p1/old.mp3');
    expect(hidden('audioBytes')).toBe('9');
  });

  it('shows a failed transfer and retries it', async () => {
    ticket.mockResolvedValue({ ok: true, uploadUrl: 'u', path: 's/p1/u-a.mp3' });
    put.mockRejectedValueOnce(new Error('Upload failed (502).')).mockResolvedValueOnce(undefined);
    renderUpload();
    pick(new File(['x'], 'a.mp3'));
    expect(await screen.findByText('Upload failed (502).')).toBeInTheDocument();
    expect(hidden('audioPath')).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(hidden('audioPath')).toBe('s/p1/u-a.mp3'));
  });

  it('names the current file when there is one', () => {
    renderUpload({ path: 's/p1/u1-knots.mp3', bytes: 24_000_000 });
    expect(screen.getByText('Current file: u1-knots.mp3 · 24 MB')).toBeInTheDocument();
  });
});
