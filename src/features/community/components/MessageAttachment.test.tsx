import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageAttachment } from './MessageAttachment';

describe('MessageAttachment', () => {
  it('shows an image inline, opening full size', () => {
    render(<MessageAttachment file={{ name: 'p.jpg', type: 'image/jpeg', size: 99, image: true, href: '/community/c/attachments/m1' }} />);
    expect(screen.getByRole('img', { name: 'p.jpg' })).toHaveAttribute('src', '/community/c/attachments/m1');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/community/c/attachments/m1');
  });

  it('shows other files as a download link with the size', () => {
    render(<MessageAttachment file={{ name: 'Notes.pdf', type: 'application/pdf', size: 2048, image: false, href: '/community/c/attachments/m2' }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('link', { name: /Notes\.pdf/ })).toHaveAttribute('href', '/community/c/attachments/m2');
    expect(screen.getByText(/2 KB|2\.0 KB/)).toBeInTheDocument();
  });
});
