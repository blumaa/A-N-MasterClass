'use client';

import { useState } from 'react';
import { cx, Skeleton } from '@mond-design-system/react';
import styles from './VimeoEmbed.module.css';

export interface VimeoEmbedProps {
  /** The player URL a media row resolves to; the id lives in the row, never here. */
  src: string;
  /** Names the frame for anyone who cannot see it — the post's title. */
  title: string;
  /** Width ÷ height, so the box is reserved before the player arrives. */
  aspect: number;
  autoPlay?: boolean;
  className?: string;
}

/* Vimeo's own player in a frame; the app gates who gets here, Vimeo checks the domain. */
export function VimeoEmbed({ src, title, aspect, autoPlay = false, className }: VimeoEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  const url = new URL(src);
  if (autoPlay) url.searchParams.set('autoplay', '1');

  return (
    <div className={cx(styles.box, className)} style={{ aspectRatio: aspect }} aria-busy={!loaded}>
      {loaded ? null : <Skeleton variant="rect" className={styles.skeleton} />}
      <iframe
        className={styles.frame}
        src={url.href}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
