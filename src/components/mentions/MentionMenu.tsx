import type { ReactElement } from 'react';
import { Avatar, cx } from '@mond-design-system/react';
import type { MentionOption } from '@/lib/mentions/markup';
import styles from './mentionTextarea.module.css';

export const mentionOptionId = (listboxId: string, index: number): string =>
  `${listboxId}-option-${index}`;

export interface MentionMenuProps {
  id: string;
  options: readonly MentionOption[];
  highlight: number;
  onHighlight: (index: number) => void;
  onSelect: (option: MentionOption) => void;
  className?: string;
}

/* The listbox under an @query; the field or editor above it owns the combobox aria. */
export function MentionMenu({
  id,
  options,
  highlight,
  onHighlight,
  onSelect,
  className,
}: MentionMenuProps): ReactElement {
  return (
    <div role="listbox" id={id} className={cx(styles.menu, className)}>
      {options.map((option, index) => (
        <div
          key={option.id}
          id={mentionOptionId(id, index)}
          role="option"
          aria-selected={index === highlight}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onSelect(option)}
          className={cx(styles.option, index === highlight && styles.optionActive)}
        >
          <Avatar
            name={option.name}
            {...(option.avatarUrl ? { src: option.avatarUrl } : {})}
            size="sm"
            decorative
          />
          <span className={styles.name}>{option.name}</span>
        </div>
      ))}
    </div>
  );
}
