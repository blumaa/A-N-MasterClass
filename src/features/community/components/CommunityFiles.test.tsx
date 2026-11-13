import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preparePhoto } from '@/lib/photo/photo';
import { putFile } from '@/lib/storage/putFile';
import { communityUploadAction } from '../uploadActions';
import { CommunityFiles } from './CommunityFiles';

vi.mock('../uploadActions', () => ({ communityUploadAction: vi.fn() }));
vi.mock('@/lib/storage/putFile', () => ({ putFile: vi.fn() }));
vi.mock('@/lib/photo/photo', () => ({ preparePhoto: vi.fn() }));

const ticket = vi.mocked(communityUploadAction);
const put = vi.mocked(putFile);
const prepare = vi.mocked(preparePhoto);

beforeEach(() => {
  ticket.mockReset();
  put.mockReset().mockResolvedValue(undefined);
  prepare.mockReset().mockImplementation(async (f) => {
    const base = f.name.replace(/\.\w+$/, '');
    if (f.type === 'image/gif') return { photo: f, thumb: null };
    return {
      photo: new File(['small'], `${base}.jpg`, { type: 'image/jpeg' }),
      thumb: new File(['t'], `${base}-thumb.jpg`, { type: 'image/jpeg' }),
    };
  });
});

const hidden = (name: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`input[type=hidden][name="${name}"]`)].map((i) => i.value);
const pick = (...files: File[]) => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files } });

describe('CommunityFiles: photos', () => {
  it('resizes each photo, uploads it and its thumbnail to their tickets and adds paired hidden fields', async () => {
    ticket.mockImplementation(async ({ fileName }) => ({ ok: true, uploadUrl: `u/${fileName}`, path: `s/c/ch/${fileName}` }));
    const onChange = vi.fn();
    render(<CommunityFiles kind="photo" target="channel" id="ch" max={10} onChange={onChange} />);
    expect(document.querySelector('input[type=file]')).toHaveAttribute('multiple');
    pick(new File(['x'], 'a.png', { type: 'image/png' }), new File(['y'], 'b.gif', { type: 'image/gif' }));
    await waitFor(() => expect(hidden('photo')).toEqual(['s/c/ch/a.jpg', 's/c/ch/b.gif']));
    expect(hidden('photoThumb')).toEqual(['s/c/ch/a-thumb.jpg', '']);
    expect(ticket).toHaveBeenCalledWith({ target: 'channel', id: 'ch', fileName: 'a.jpg', type: 'image/jpeg', sizeBytes: 5 });
    expect(ticket).toHaveBeenCalledWith({ target: 'channel', id: 'ch', fileName: 'a-thumb.jpg', type: 'image/jpeg', sizeBytes: 1 });
    expect(put).toHaveBeenCalledWith('u/a.jpg', expect.any(File), expect.any(Function));
    expect(put).toHaveBeenCalledWith('u/a-thumb.jpg', expect.any(File), expect.any(Function));
    expect(ticket).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ ready: 2, busy: false }));
  });

  it('fails the photo when its thumbnail is refused', async () => {
    ticket.mockResolvedValueOnce({ ok: true, uploadUrl: 'u', path: 's/c/ch/a.jpg' });
    ticket.mockResolvedValueOnce({ ok: false, message: 'Too many uploads.' });
    render(<CommunityFiles kind="photo" target="channel" id="ch" max={10} onChange={vi.fn()} />);
    pick(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(await screen.findByText('Too many uploads.')).toBeInTheDocument();
    expect(hidden('photo')).toEqual([]);
  });

  it('takes no more than the max and says so', async () => {
    ticket.mockResolvedValue({ ok: true, uploadUrl: 'u', path: 'p' });
    render(<CommunityFiles kind="photo" target="channel" id="ch" max={1} onChange={vi.fn()} />);
    pick(new File(['x'], 'a.png', { type: 'image/png' }), new File(['y'], 'b.png', { type: 'image/png' }));
    expect(await screen.findByText('Up to 1 photo per post.')).toBeInTheDocument();
    await waitFor(() => expect(hidden('photo')).toEqual(['p']));
    expect(ticket).toHaveBeenCalledTimes(2);
  });

  it('shows a refused ticket and adds no field; remove drops a photo', async () => {
    ticket.mockResolvedValueOnce({ ok: false, message: 'You cannot add files here.' });
    ticket.mockResolvedValueOnce({ ok: true, uploadUrl: 'u', path: 's/c/ch/1-b.jpg' });
    ticket.mockResolvedValueOnce({ ok: true, uploadUrl: 'u', path: 's/c/ch/1-b-thumb.jpg' });
    render(<CommunityFiles kind="photo" target="channel" id="ch" max={10} onChange={vi.fn()} />);
    pick(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(await screen.findByText('You cannot add files here.')).toBeInTheDocument();
    pick(new File(['y'], 'b.png', { type: 'image/png' }));
    await waitFor(() => expect(hidden('photo')).toEqual(['s/c/ch/1-b.jpg']));
    for (const button of screen.getAllByRole('button', { name: 'Remove' })) fireEvent.click(button);
    expect(hidden('photo')).toEqual([]);
    expect(hidden('photoThumb')).toEqual([]);
  });
});

describe('CommunityFiles: attachment', () => {
  it('uploads one file as it is and fills path, name, type and size', async () => {
    ticket.mockResolvedValue({ ok: true, uploadUrl: 'u', path: 's/c/dm/t/1-notes.pdf' });
    const onChange = vi.fn();
    render(<CommunityFiles kind="attachment" target="thread" id="t" max={1} onChange={onChange} />);
    expect(document.querySelector('input[type=file]')).not.toHaveAttribute('multiple');
    pick(new File(['abc'], 'Notes.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(hidden('attachmentPath')).toEqual(['s/c/dm/t/1-notes.pdf']));
    expect(hidden('attachmentName')).toEqual(['Notes.pdf']);
    expect(hidden('attachmentType')).toEqual(['application/pdf']);
    expect(hidden('attachmentSize')).toEqual(['3']);
    expect(prepare).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ ready: 1, busy: false }));
  });
});
