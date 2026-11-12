import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteError, RouteLoading } from './RouteStatus';

describe('RouteLoading', () => {
  it('announces that the page is loading', () => {
    render(<RouteLoading />);
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument();
  });
});

describe('RouteError', () => {
  it('says something went wrong and retries on request', () => {
    const retry = vi.fn();
    render(<RouteError retry={retry} />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });
});
