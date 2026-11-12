import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { MoveButtons } from './MoveButtons';

const action = vi.fn(async () => null);
const Form = (props: Omit<ActionFormProps, 'action'>) => <ActionForm action={action} {...props} />;

describe('MoveButtons', () => {
  it('shows both directions in the middle, each posting its direction', () => {
    const { container } = render(<MoveButtons form={Form} fields={{ op: 'move', id: 'x' }} first={false} last={false} />);
    expect(screen.getByRole('button', { name: 'Move up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument();
    const directions = [...container.querySelectorAll('input[name="direction"]')].map((i) => (i as HTMLInputElement).value);
    expect(directions).toEqual(['up', 'down']);
  });

  it('hides up on the first row and down on the last', () => {
    render(<MoveButtons form={Form} fields={{ id: 'x' }} first last />);
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move down' })).toBeNull();
  });
});
