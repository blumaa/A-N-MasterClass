import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTyping } from '@/components/Typing/useTyping';
import { ChatComposer } from './ChatComposer';

vi.mock('@/components/Typing/useTyping', () => ({ useTyping: vi.fn() }));
// Upload action is server-only; files are not under test here.
vi.mock('./CommunityFiles', () => ({ CommunityFiles: () => null }));

const typed = vi.fn();
const stop = vi.fn();
const CONFIG = { topic: 'typing-channel:c1', me: 'me', people: [{ id: 'a', name: 'Ann' }] };
const composer = { action: vi.fn(), fields: {}, members: [], submit: 'Send', label: 'Message' };

beforeEach(() => {
  typed.mockReset();
  stop.mockReset();
  vi.mocked(useTyping).mockReturnValue({ line: 'Ann is typing…', typed, stop });
});

describe('ChatComposer', () => {
  it('shows who types in a polite live region under the composer and wires the box', () => {
    render(<ChatComposer typing={CONFIG} composer={composer} />);
    expect(useTyping).toHaveBeenCalledWith(CONFIG);
    const status = screen.getByText('Ann is typing…');
    expect(status).toHaveAttribute('aria-live', 'polite');
    const box = screen.getByLabelText('Message');
    expect(box.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(box, { target: { value: 'x' } });
    expect(typed).toHaveBeenCalledOnce();
    fireEvent.blur(box);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('a reader who may not send still sees who types', () => {
    render(<ChatComposer typing={CONFIG} composer={null} />);
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.getByText('Ann is typing…')).toBeInTheDocument();
  });

  it('no live region when typing is off (fake mode, signed out)', () => {
    vi.mocked(useTyping).mockReturnValue({ line: '', typed, stop });
    const { container } = render(<ChatComposer typing={null} composer={composer} />);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});
