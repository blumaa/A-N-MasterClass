import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReportEntry, ReportQueue as Queue } from '../api/reports';
import { ReportQueue } from './ReportQueue';

const reportAction = vi.hoisted(() => vi.fn(async (_prev: unknown, _form: FormData) => null));
vi.mock('../reportActions', () => ({ reportAction }));

const AT = new Date('2026-11-12T12:00:00Z');
const entry = (over: Partial<ReportEntry>): ReportEntry => ({
  id: 'r1',
  targetType: 'post',
  channel: 'General',
  href: '/community/c/posts/p1',
  preview: { author: 'Alexander', body: 'Buy now' },
  reason: 'spam',
  createdAt: AT,
  reporter: 'Robin',
  status: 'open',
  resolvedBy: null,
  resolvedAt: null,
  ...over,
});
const queue = (over: Partial<Queue> = {}): Queue =>
  ({ community: { id: 'c' }, reporters: true, open: [entry({})], resolved: [], ...over }) as Queue;

describe('ReportQueue', () => {
  it('lists open reports with preview, reason, reporter and the two actions', () => {
    render(<ReportQueue queue={queue()} />);
    const open = screen.getByRole('list', { name: 'Open reports' });
    expect(within(open).getByRole('link', { name: /Post in General/ })).toHaveAttribute('href', '/community/c/posts/p1');
    expect(open).toHaveTextContent('Alexander: Buy now');
    expect(open).toHaveTextContent('Reason: spam');
    expect(open).toHaveTextContent('Reported by Robin');
    fireEvent.click(within(open).getByRole('button', { name: 'Dismiss' }));
    const form = reportAction.mock.calls[0]![1];
    expect(Object.fromEntries(form.entries())).toEqual({ op: 'resolveReport', reportId: 'r1', action: 'dismiss' });
    expect(within(open).getByRole('button', { name: 'Remove content' })).toBeInTheDocument();
    fireEvent.click(within(open).getByRole('button', { name: 'Hide' }));
    expect(Object.fromEntries(reportAction.mock.calls[1]![1].entries())).toMatchObject({ action: 'hide' });
  });

  it('offers no Hide on chat lines; signs hidden reports', () => {
    render(
      <ReportQueue
        queue={queue({
          open: [entry({ targetType: 'message' })],
          resolved: [entry({ id: 'r2', status: 'hidden', resolvedBy: 'Sam', resolvedAt: AT })],
        })}
      />,
    );
    expect(within(screen.getByRole('list', { name: 'Open reports' })).queryByRole('button', { name: 'Hide' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Resolved reports' })).toHaveTextContent(/Hidden by Sam/);
  });

  it('hides the reporter when not shown; marks removed content; keeps resolved reports signed', () => {
    render(
      <ReportQueue
        queue={queue({
          reporters: false,
          open: [entry({ reporter: null, preview: null, reason: null })],
          resolved: [entry({ id: 'r2', targetType: 'message', status: 'removed', resolvedBy: 'Sam', resolvedAt: AT })],
        })}
      />,
    );
    const open = screen.getByRole('list', { name: 'Open reports' });
    expect(open).toHaveTextContent('Content removed');
    expect(open).not.toHaveTextContent('Reported by');
    expect(open).not.toHaveTextContent('Reason');
    const resolved = screen.getByRole('list', { name: 'Resolved reports' });
    expect(resolved).toHaveTextContent('Chat line in General');
    expect(resolved).toHaveTextContent(/Removed by Sam/);
    expect(within(resolved).queryByRole('button')).toBeNull();
  });

  it('says when nothing is open', () => {
    render(<ReportQueue queue={queue({ open: [] })} />);
    expect(screen.getByText('No open reports')).toBeInTheDocument();
  });
});
