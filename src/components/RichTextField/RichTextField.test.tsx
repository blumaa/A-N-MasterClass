import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from '@/components/ui/mds';
import type { Doc } from '@/lib/doc/doc';
import { asHref, RichTextField } from './RichTextField';

const doc = (text: string): Doc => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const posted = (container: HTMLElement) => JSON.parse((container.querySelector('input[name="text"]') as HTMLInputElement).value);

describe('RichTextField', () => {
  it('is a labelled textbox with a formatting toolbar', async () => {
    render(
      <Field label="Text">
        <RichTextField name="text" label="Text" defaultValue={null} />
      </Field>,
    );
    expect(await screen.findByRole('textbox', { name: 'Text' })).toHaveAttribute('aria-multiline', 'true');
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the document it was given and posts it', async () => {
    const { container } = render(<RichTextField name="text" label="Text" defaultValue={doc('Breathe')} />);
    expect(await screen.findByRole('textbox', { name: 'Text' })).toHaveTextContent('Breathe');
    expect(posted(container)).toEqual(doc('Breathe'));
  });

  it('posts the change when a format is pressed', async () => {
    const { container } = render(<RichTextField name="text" label="Text" defaultValue={doc('Breathe')} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Heading' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Heading' })).toHaveAttribute('aria-pressed', 'true'));
    expect(posted(container).content[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
  });

  it('opens a link address field', async () => {
    render(<RichTextField name="text" label="Text" defaultValue={null} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Link' }));
    expect(screen.getByRole('textbox', { name: 'Link address' })).toBeInTheDocument();
  });
});

describe('asHref', () => {
  it('leaves an address with a scheme alone', () => {
    expect(asHref('http://example.org/x')).toBe('http://example.org/x');
  });

  it('assumes https for a bare host', () => {
    expect(asHref(' example.org/x ')).toBe('https://example.org/x');
  });
});
