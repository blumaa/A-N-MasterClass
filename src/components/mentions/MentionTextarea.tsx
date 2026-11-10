'use client';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import { cx, useFieldContext, type CSSVars } from '@mond-design-system/react';
import { filterMembers } from '@/lib/mentions/filter';
import {
  applyDisplayChange,
  detectMentionQuery,
  getPlainText,
  insertMention,
  type ActiveMention,
  type MentionOption,
} from '@/lib/mentions/markup';
import { MentionMenu, mentionOptionId } from './MentionMenu';
import styles from './mentionTextarea.module.css';

export interface MentionTextareaProps {
  /* Markup value (`@[Name](id)` tokens); the field displays `@Name`. */
  value: string;
  onChange: (next: string) => void;
  /* People who may be mentioned, fetched once by the server (directory of the space). */
  members: readonly MentionOption[];
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
}

const MENU_MAX = 240;

/* A textarea with an @mention autocomplete. Combobox pattern per APG; the
   dropdown flips above when the viewport below is short. Sits inside an MDS
   Field when one wraps it (id/describedBy/invalid via context). */
export function MentionTextarea({
  value,
  onChange,
  members,
  rows,
  placeholder,
  disabled,
  'aria-label': ariaLabel,
  fieldRef,
}: MentionTextareaProps): ReactElement {
  const field = useFieldContext();
  const listboxId = useId();
  const hostRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const [active, setActive] = useState<ActiveMention | null>(null);
  const options = active === null ? [] : filterMembers(members, active.query);
  const [highlight, setHighlight] = useState(0);
  const [placement, setPlacement] = useState<'below' | 'above'>('below');

  const open = active !== null && options.length > 0;

  const setHost = (el: HTMLTextAreaElement | null): void => {
    hostRef.current = el;
    if (fieldRef !== undefined) fieldRef.current = el;
  };

  const close = useCallback((): void => {
    setActive(null);
    setHighlight(0);
  }, []);

  // restore the caret the pure functions computed, after React commits the value
  useLayoutEffect(() => {
    const host = hostRef.current;
    const caret = pendingCaret.current;
    if (host && caret !== null) {
      host.setSelectionRange(caret, caret);
      pendingCaret.current = null;
    }
  }, [value]);

  useLayoutEffect(() => {
    if (!open) return;
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setPlacement(spaceBelow < MENU_MAX + 12 && spaceAbove > spaceBelow ? 'above' : 'below');
  }, [open, options.length]);

  useEffect(() => {
    const onDoc = (event: MouseEvent): void => {
      const container = containerRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        close();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [close]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const res = applyDisplayChange(value, event.target.value);
    onChange(res.value);
    pendingCaret.current = res.caret;
    const found = detectMentionQuery(getPlainText(res.value), res.caret);
    if (found) {
      setActive(found);
      setHighlight(0);
    } else {
      close();
    }
  };

  const select = (option: MentionOption): void => {
    if (active === null) return;
    const host = hostRef.current;
    const caret = host?.selectionStart ?? getPlainText(value).length;
    const res = insertMention(value, active, caret, option);
    onChange(res.value);
    pendingCaret.current = res.caret;
    close();
    host?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      const option = options[highlight];
      if (option) select(option);
    } else if (event.key === 'Escape') {
      // ours, not the surrounding Sheet's
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const invalid = field?.invalid ?? false;
  const vars: CSSVars = { '--mention-menu-max': `${MENU_MAX}px` };

  return (
    <div ref={containerRef} className={styles.container} style={vars}>
      <textarea
        ref={setHost}
        id={field?.id}
        rows={rows}
        value={getPlainText(value)}
        disabled={disabled}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={close}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? mentionOptionId(listboxId, highlight) : undefined}
        aria-describedby={field?.describedBy}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        className={cx(styles.host, invalid && styles.invalid)}
      />
      {open ? (
        <MentionMenu
          id={listboxId}
          options={options}
          highlight={highlight}
          onHighlight={setHighlight}
          onSelect={select}
          className={placement === 'above' ? styles.above : styles.below}
        />
      ) : null}
    </div>
  );
}
