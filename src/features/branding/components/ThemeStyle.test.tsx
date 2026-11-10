import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeStyle } from './ThemeStyle';

describe('ThemeStyle', () => {
  it('renders the css in an enabled <style>', () => {
    const { container } = render(<ThemeStyle css=":root:root{--brand-accent:#112233;}" />);
    const style = container.querySelector('style')!;
    expect(style.textContent).toBe(':root:root{--brand-accent:#112233;}');
    expect(style.media).toBe('');
  });

  it('disables the sheet on unmount/hide so a hidden route cannot theme the visible one', () => {
    const { container, unmount } = render(<ThemeStyle css=":root:root{--brand-accent:#112233;}" />);
    const style = container.querySelector('style')!;
    unmount();
    expect(style.media).toBe('not all');
  });

  it('renders nothing for empty css', () => {
    const { container } = render(<ThemeStyle css="" />);
    expect(container.querySelector('style')).toBeNull();
  });
});
