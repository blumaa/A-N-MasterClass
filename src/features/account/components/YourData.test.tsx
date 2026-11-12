import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YourData } from './YourData';

const action = vi.fn(async () => null);

describe('YourData', () => {
  it('links the export and asks before deleting', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<YourData exportHref="/account/data.json" deleteAction={action} spaceName="Alexander" canDelete />);
    expect(screen.getByRole('link', { name: 'Download my data' })).toHaveAttribute('href', '/account/data.json');
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Alexander'));
    expect(action).not.toHaveBeenCalled();
  });

  it('tells the owner why there is no delete button', () => {
    render(<YourData exportHref="/account/data.json" deleteAction={action} spaceName="Alexander" canDelete={false} />);
    expect(screen.queryByRole('button', { name: 'Delete my account' })).toBeNull();
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
  });
});
