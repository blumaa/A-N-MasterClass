import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Doc } from '@/lib/doc/doc';
import { DocBody } from './DocBody';

const doc = (...content: Doc['content'] & object): Doc => ({ type: 'doc', content });
const text = (value: string, marks?: { type: string; attrs?: Record<string, string> }[]) => ({ type: 'text', text: value, marks });

describe('DocBody', () => {
  it('draws headings, paragraphs and marks', () => {
    render(
      <DocBody
        doc={doc(
          { type: 'heading', attrs: { level: 2 }, content: [text('Breath')] },
          { type: 'paragraph', content: [text('Slow '), text('down', [{ type: 'bold' }]), text(' now', [{ type: 'italic' }])] },
        )}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Breath' })).toBeInTheDocument();
    expect(screen.getByText('down').tagName).toBe('STRONG');
    expect(screen.getByText('now').tagName).toBe('EM');
  });

  it('draws lists and quotes', () => {
    render(
      <DocBody
        doc={doc(
          { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('First')] }] }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [text('Said')] }] },
        )}
      />,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('First');
    expect(screen.getByText('Said').closest('blockquote')).not.toBeNull();
  });

  it('links only http(s) addresses', () => {
    render(
      <DocBody
        doc={doc({
          type: 'paragraph',
          content: [
            text('safe', [{ type: 'link', attrs: { href: 'https://example.org' } }]),
            text(' bad', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
          ],
        })}
      />,
    );
    expect(screen.getByRole('link', { name: 'safe' })).toHaveAttribute('href', 'https://example.org');
    expect(screen.queryByRole('link', { name: /bad/ })).toBeNull();
  });

  it('skips nodes it does not know', () => {
    const { container } = render(<DocBody doc={doc({ type: 'script', content: [text('x')] } as never)} />);
    expect(container.querySelector('script')).toBeNull();
  });
});
