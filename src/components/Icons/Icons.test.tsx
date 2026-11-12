import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from '@/components/ui/mds';
import { Icons } from './Icons';

describe('Icons', () => {
  it.each(['arrow-up', 'arrow-down', 'bold', 'italic', 'heading-2', 'heading-3', 'list', 'list-ordered', 'text-quote', 'link'])('draws %s', (name) => {
    const { container } = render(
      <Icons>
        <Icon name={name} />
      </Icons>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('draws nothing for an unknown name', () => {
    const { container } = render(
      <Icons>
        <Icon name="nope" />
      </Icons>,
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});
