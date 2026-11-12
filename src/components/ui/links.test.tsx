import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackLink, ButtonLink } from './links';

describe('ButtonLink', () => {
  it('marks a file link as a download', () => {
    render(
      <ButtonLink href="/account/data.json" download>
        Download
      </ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('download');
  });

  it('is a plain link by default', () => {
    render(<ButtonLink href="/library">Library</ButtonLink>);
    expect(screen.getByRole('link', { name: 'Library' })).not.toHaveAttribute('download');
  });
});

describe('BackLink', () => {
  it('says where it goes back to', () => {
    render(<BackLink href="#offers">Offers</BackLink>);
    expect(screen.getByRole('link', { name: 'Back to Offers' })).toHaveAttribute('href', '#offers');
  });
});
