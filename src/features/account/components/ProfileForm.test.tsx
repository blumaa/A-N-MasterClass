import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileForm } from './ProfileForm';

vi.mock('@/components/ImageUpload/actions', () => ({ requestImageUploadAction: vi.fn() }));

const src = (path: string) => `https://files.test/${path}`;
const action = vi.fn(async () => null);
const profile = { spaceId: 's', profileId: 'u', displayName: 'Robin', bio: 'Hello', avatarPath: 's/avatars/u/a.png' };

describe('ProfileForm', () => {
  it('fills name, bio and the current photo', () => {
    render(<ProfileForm action={action} profile={profile} imageSrc={src} />);
    expect(screen.getByLabelText('Display name')).toHaveValue('Robin');
    expect(screen.getByLabelText('Bio')).toHaveValue('Hello');
    expect(document.querySelector<HTMLInputElement>('input[type=hidden][name="avatarPath"]')!.value).toBe('s/avatars/u/a.png');
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeInTheDocument();
  });

  it('caps lengths like the server does', () => {
    render(<ProfileForm action={action} profile={{ ...profile, bio: null, avatarPath: null }} imageSrc={src} />);
    expect(screen.getByLabelText('Display name')).toHaveAttribute('maxLength', '80');
    expect(screen.getByLabelText('Bio')).toHaveAttribute('maxLength', '1000');
    expect(screen.getByLabelText('Bio')).toHaveValue('');
  });
});
