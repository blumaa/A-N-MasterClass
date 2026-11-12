import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublishStatusBadge } from './PublishStatusBadge';

describe('PublishStatusBadge', () => {
  it('shows a readable label, not the raw value', () => {
    render(
      <>
        <PublishStatusBadge status="published" />
        <PublishStatusBadge status="draft" />
      </>,
    );
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});
