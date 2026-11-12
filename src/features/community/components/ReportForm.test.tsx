import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportForm } from './ReportForm';

const reportAction = vi.fn(async (_prev: unknown, _form: FormData) => ({ message: 'Thanks', ok: true as const }));

describe('ReportForm', () => {
  it('sends the target and reason, then thanks the reporter', async () => {
    render(<ReportForm targetType="comment" targetId="c1" action={reportAction} />);
    fireEvent.click(screen.getByText('Report'));
    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'rude' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks');
    const form = reportAction.mock.calls[0]![1];
    expect(Object.fromEntries(form.entries())).toEqual({ op: 'report', targetType: 'comment', targetId: 'c1', reason: 'rude' });
  });
});
