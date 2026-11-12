import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubmitButton } from './SubmitButton';

describe('SubmitButton', () => {
  it('submits its form and shows busy while the action runs', async () => {
    let finish = () => {};
    const action = () => new Promise<void>((resolve) => (finish = resolve));
    render(
      <form action={action}>
        <SubmitButton>Sign out</SubmitButton>
      </form>,
    );
    const button = screen.getByRole('button', { name: /Sign out/ });
    expect(button).toHaveAttribute('type', 'submit');
    fireEvent.click(button);
    await screen.findByRole('button', { busy: true });
    finish();
    await screen.findByRole('button', { busy: false });
  });
});
