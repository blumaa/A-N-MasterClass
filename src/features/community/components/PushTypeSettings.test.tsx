import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_TYPES } from '@/lib/data/types';
import { PUSH_TYPE_LABELS } from './labels';
import { PushTypeSettings } from './PushTypeSettings';

const settings = NOTIFICATION_TYPES.map((type) => ({ type, on: type !== 'reaction' }));

describe('PushTypeSettings', () => {
  it('shows one switch per type with its saved state', () => {
    render(<PushTypeSettings settings={settings} action={vi.fn(async () => null)} />);
    for (const s of settings) {
      const box = screen.getByRole('switch', { name: PUSH_TYPE_LABELS[s.type] });
      expect((box as HTMLInputElement).checked).toBe(s.on);
    }
  });

  it('posts the types left on and toasts on save', async () => {
    const action = vi.fn(async (_prev: unknown, _form: FormData) => null);
    render(<PushTypeSettings settings={settings} action={action} />);
    fireEvent.click(screen.getByRole('switch', { name: PUSH_TYPE_LABELS.mention }));
    fireEvent.click(screen.getByRole('button', { name: 'Save push settings' }));
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    expect(action.mock.calls[0]![1].getAll('on')).toEqual(['comment', 'reply', 'step_comment', 'report']);
    expect(await within(screen.getByRole('region', { name: 'Status messages' })).findByText('Push settings saved')).toBeInTheDocument();
  });
});
