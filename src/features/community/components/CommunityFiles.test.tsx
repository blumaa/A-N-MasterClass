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
  prepare.mockReset().mockImplementation(async (f) => new File(['small'], f.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
});

const hidden = (name: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`input[type=hidden][name="${name}"]`)].map((i) => i.value);
const pick = (...files: File[]) => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files } });

describe('CommunityFiles: photos', () => {
  it('resizes each photo, uploads it to its ticket and adds a hidden photo field', async () => {
    ticket.mockResolvedValueOnce({ ok: true, uploadUrl: 'u1', path: 's/c/ch/1-a.jpg' });
    ticket.mockResolvedValueOnce({ ok: true, uploadUrl: 'u2', path: 's/c/ch/2-b.jpg' });
    const onChange = vi.fn();
    render(<CommunityFiles kind="photo" target="channel" id="ch" max={10} onChange={onChange} />);
    expect(document.querySelector('input[type=file]')).toHaveAttribute('multiple');
    pick(new File(['x'], 'a.png', { type: 'image/png' }), new File(['y'], 'b.png', { type: 'image/png' }));
    await waitFor(() => expect(hidden('photo')).toEqual(['s/c/ch/1-a.jpg', 's/c/ch/2-b.jpg']));
    expect(ticket).toHaveBeenCalledWith({ target: 'channel', id: 'ch', fileName: 'a.jpg', type: 'image/jpeg', sizeBytes: 5 });
    expect(put).toHaveBeenCalledWith('u1', expect.any(File), expect.any(Function));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ ready: 2, busy: false }));
  });

  it('takes no more than the max and says so', async () => {
    ticket.mockResolvedValue({ ok: true, uploadUrl: 'u', path: 'p' });
    render(<CommunityFiles kind="photo" target="channel" id="ch" max={1} onChange={vi.fn()} />);
    pick(new File(['x'], 'a.png', { type: 'image/png' }), new File(['y'], 'b.png', { type: 'image/png' }));
    expect(await screen.findByText('Up to 1 photo per post.')).toBeInTheDocument();
    await waitFor(() => expect(hidden('photo')).toEqual(['p']));
    expect(ticket).toHaveBeenCalledOnce();
  });

  it('shows a refused ticket and adds no field; remove drops a photo', async () => {
    ticket.mockResolvedValueOnce({ ok: false, message: 'You cannot add files here.' });
    ticket.mockResolvedValueOnce({ ok: true, uploadUrl: 'u', path: 's/c/ch/1-b.jpg' });
    render(<CommunityFiles kind="photo" target="channel" id="ch" max={10} onChange={vi.fn()} />);
    pick(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(await screen.findByText('You cannot add files here.')).toBeInTheDocument();
    pick(new File(['y'], 'b.png', { type: 'image/png' }));
    await waitFor(() => expect(hidden('photo')).toEqual(['s/c/ch/1-b.jpg']));
    for (const button of screen.getAllByRole('button', { name: 'Remove' })) fireEvent.click(button);
    expect(hidden('photo')).toEqual([]);
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
