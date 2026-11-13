import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SharedCertificate } from '@/lib/data/types';
import { SharedCertificateCard } from './SharedCertificateCard';

const certificate: SharedCertificate = {
  memberName: 'Robin',
  programTitle: 'Shibari 101',
  issuedAt: new Date('2026-11-10T12:00:00Z'),
  serial: '00000000-0000-4000-8000-000000000001',
};

describe('SharedCertificateCard', () => {
  it('shows who finished which program, when, and the serial', () => {
    render(<SharedCertificateCard spaceName="Alexander Rope" logoSrc={null} certificate={certificate} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Certificate of completion' })).toBeInTheDocument();
    expect(screen.getByText('Alexander Rope')).toBeInTheDocument();
    expect(screen.getByText('Robin')).toBeInTheDocument();
    expect(screen.getByText('Shibari 101')).toBeInTheDocument();
    expect(screen.getByText('November 10, 2026')).toBeInTheDocument();
    expect(screen.getByText(`Certificate ${certificate.serial}`)).toBeInTheDocument();
  });

  it('shows the logo in place of the space name', () => {
    render(<SharedCertificateCard spaceName="Alexander Rope" logoSrc="https://a.test/logo.png" certificate={certificate} />);
    expect(screen.getByRole('img', { name: 'Alexander Rope' })).toBeInTheDocument();
    expect(screen.queryByText('Alexander Rope')).toBeNull();
  });
});
