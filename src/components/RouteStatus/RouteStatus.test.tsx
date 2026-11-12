import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteError, RouteLoading, RouteNotFound } from './RouteStatus';

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

describe('RouteNotFound', () => {
  it('says the page is missing and links home', () => {
    render(<RouteNotFound />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });
});
