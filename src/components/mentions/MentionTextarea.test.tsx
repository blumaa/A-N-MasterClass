import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MentionOption } from '@/lib/mentions/markup';
import { MentionTextarea } from './MentionTextarea';
import styles from './mentionTextarea.module.css';

const MEMBERS: MentionOption[] = [
  { id: 'u1', name: 'Ada Lovelace' },
  { id: 'u2', name: 'Alan Turing' },
];

function Harness({ members = MEMBERS }: { members?: MentionOption[] }) {
  const [value, setValue] = useState('');
  return (
    <div>
      <MentionTextarea
        aria-label="composer"
        value={value}
        onChange={setValue}
        members={members}
      />
      <output data-testid="value">{value}</output>
    </div>
  );
}

/* fireEvent.change with the caret parked at the end, like real typing. */
function typeInto(el: HTMLTextAreaElement, next: string): void {
  fireEvent.change(el, { target: { value: next } });
  el.setSelectionRange(next.length, next.length);
}

describe('MentionTextarea', () => {
  it('tells the owner when the field loses focus', () => {
    const onBlur = vi.fn();
    render(<MentionTextarea aria-label="composer" value="" onChange={() => {}} members={MEMBERS} onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole('combobox', { name: 'composer' }));
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('renders a closed combobox on a textarea', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' });
    expect(host.tagName).toBe('TEXTAREA');
    expect(host).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the listbox when an @query matches members', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, 'hi @ad');
    expect(host).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });

  it('narrows the options as the query grows', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, '@A');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    typeInto(host, '@Al');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Alan Turing' })).toBeInTheDocument();
  });

  it('flips the menu above when the field sits near the bottom of the viewport', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 740,
      bottom: 760,
      left: 0,
      right: 300,
      width: 300,
      height: 20,
      x: 0,
      y: 740,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      render(<Harness />);
      const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
      typeInto(host, '@ad');
        const menu = screen.getByRole('listbox');
      expect(menu.className.split(' ')).toContain(styles.above);
      expect(menu.className.split(' ')).not.toContain(styles.below);
    } finally {
      spy.mockRestore();
    }
  });

  it('opens below when there is room', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 40,
      bottom: 60,
      left: 0,
      right: 300,
      width: 300,
      height: 20,
      x: 0,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      render(<Harness />);
      const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
      typeInto(host, '@ad');
        const menu = screen.getByRole('listbox');
      expect(menu.className.split(' ')).toContain(styles.below);
    } finally {
      spy.mockRestore();
    }
  });

  it('stays closed when @ is glued to a word (emails)', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, 'me@host');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('inserts a token with a trailing space on click and closes', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, 'hi @ad');
    fireEvent.click(screen.getByRole('option', { name: 'Ada Lovelace' }));
    expect(screen.getByTestId('value')).toHaveTextContent('hi @[Ada Lovelace](u1)');
    expect(host).toHaveValue('hi @Ada Lovelace ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects the highlighted option with ArrowDown + Enter', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, '@a');
    fireEvent.keyDown(host, { key: 'ArrowDown' });
    fireEvent.keyDown(host, { key: 'Enter' });
    expect(screen.getByTestId('value')).toHaveTextContent('@[Alan Turing](u2)');
  });

  it('tracks the highlight in aria-activedescendant', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, '@a');
    const first = screen.getByRole('option', { name: 'Ada Lovelace' });
    const second = screen.getByRole('option', { name: 'Alan Turing' });
    expect(host).toHaveAttribute('aria-activedescendant', first.id);
    fireEvent.keyDown(host, { key: 'ArrowDown' });
    expect(host).toHaveAttribute('aria-activedescendant', second.id);
  });

  it('closes on Escape and keeps the text', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, '@ad');
    fireEvent.keyDown(host, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(host).toHaveValue('@ad');
  });

  it('closes when clicking outside', () => {
    render(<Harness />);
    const host = screen.getByRole('combobox', { name: 'composer' }) as HTMLTextAreaElement;
    typeInto(host, '@ad');
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
