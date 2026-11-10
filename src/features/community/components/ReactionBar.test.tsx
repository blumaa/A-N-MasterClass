import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReactionBar } from './ReactionBar';

describe('ReactionBar', () => {
  it('toggles off the viewer reaction and on a new one', async () => {
    const seen: string[] = [];
    const action = vi.fn(async (_prev: unknown, form: FormData) => {
      seen.push(`${form.get('emoji')}:${form.get('on')}:${form.get('targetId')}`);
      return null;
    });
    render(<ReactionBar action={action} targetType="post" targetId="p1" reactions={[{ emoji: '👍', count: 2, mine: true }]} enabled />);
    fireEvent.click(screen.getByRole('button', { name: '👍 2' }));
    fireEvent.click(screen.getByRole('button', { name: '🔥' }));
    await waitFor(() => expect(seen).toEqual(['👍:false:p1', '🔥:true:p1']));
  });

  it('shows counts only when disabled', () => {
    render(<ReactionBar action={vi.fn()} targetType="post" targetId="p1" reactions={[{ emoji: '❤️', count: 1, mine: false }]} enabled={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('❤️ 1')).toBeInTheDocument();
  });
});
