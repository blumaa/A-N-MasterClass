import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthPanel } from './AuthPanel';

describe('AuthPanel', () => {
  it('shows the title as the page heading, the intro and the form', () => {
    render(
      <AuthPanel title="Sign in" intro="Use the email you bought with.">
        <button type="submit">Go</button>
      </AuthPanel>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Use the email you bought with.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('leaves the intro out when there is none', () => {
    const { container } = render(<AuthPanel title="Sign in">form</AuthPanel>);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
