import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VimeoEmbed } from './VimeoEmbed';

const SRC = 'https://player.vimeo.com/video/76979871?dnt=1';

describe('VimeoEmbed', () => {
  it('frames the player, named after the post, with tracking off', () => {
    render(<VimeoEmbed src={SRC} title="Kihon no kata" aspect={1.777} />);

    const frame = screen.getByTitle('Kihon no kata');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', SRC);
    expect(frame).toHaveAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    expect(frame).not.toHaveAttribute('allowfullscreen');
  });

  it('asks the player to start when the reader has said so', () => {
    render(<VimeoEmbed src={SRC} title="Kihon no kata" aspect={1.777} autoPlay />);

    expect(screen.getByTitle('Kihon no kata')).toHaveAttribute('src', `${SRC}&autoplay=1`);
  });

  it('reserves the box at the video’s aspect, and is busy until the player arrives', () => {
    const { container } = render(<VimeoEmbed src={SRC} title="Kihon no kata" aspect={1.5} />);

    const box = container.firstElementChild as HTMLElement;
    expect(box.style.aspectRatio).toMatch(/^1\.5\b/);
    expect(box).toHaveAttribute('aria-busy', 'true');

    fireEvent.load(screen.getByTitle('Kihon no kata'));

    expect(box).toHaveAttribute('aria-busy', 'false');
  });
});
