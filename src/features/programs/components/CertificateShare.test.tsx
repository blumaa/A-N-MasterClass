import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CertificateShare } from './CertificateShare';

vi.mock('../actions', () => ({ shareCertificateAction: vi.fn() }));

const URL = `https://a.test/certificates/${'ab'.repeat(16)}`;
const hidden = (name: string) => document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)?.value;

afterEach(() => vi.restoreAllMocks());

describe('CertificateShare', () => {
  it('offers to share when no link exists', () => {
    render(<CertificateShare program="shibari-101" url={null} />);
    expect(screen.getByRole('button', { name: 'Share certificate' })).toBeInTheDocument();
    expect(hidden('program')).toBe('shibari-101');
    expect(hidden('shared')).toBe('true');
    expect(screen.queryByLabelText('Public certificate link')).toBeNull();
  });

  it('shows the live link and asks before turning it off', () => {
    render(<CertificateShare program="shibari-101" url={URL} />);
    expect(screen.getByLabelText('Public certificate link')).toHaveValue(URL);
    expect(hidden('shared')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Stop sharing?' });
    expect(dialog).toHaveTextContent(/stops working/);
  });
});
