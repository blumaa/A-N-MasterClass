import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavEditor } from './NavEditor';

vi.mock('../actions', () => ({ editSiteAction: vi.fn() }));

describe('NavEditor', () => {
  it('posts header and footer rows with blank rows to add more', () => {
    render(<NavEditor header={[{ label: 'About', href: '/about' }]} footer={[]} />);
    expect(screen.getByDisplayValue('About')).toHaveAttribute('name', 'header.0.label');
    expect(screen.getByDisplayValue('/about')).toHaveAttribute('name', 'header.0.href');
    expect(document.querySelector('[name="header.1.label"]')).toHaveValue('');
    expect(document.querySelector('[name="footer.0.label"]')).toHaveValue('');
    expect(document.querySelector('input[type="hidden"][name="op"]')).toHaveValue('saveNav');
  });
});
