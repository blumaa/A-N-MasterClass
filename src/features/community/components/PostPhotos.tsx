// Photos of a post, in a grid of thumbnails. Each opens full size; the signed route checks read access.
// `remove`: author or moderator, on the post page.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import type { PostItem } from '../api/feed';
import styles from './community.module.css';

type Props = { postId: string; photos: PostItem['photos']; action: FormAction; remove: boolean };

export function PostPhotos({ postId, photos, action, remove }: Props) {
  if (photos.length === 0) return null;
  return (
    <ul aria-label="Photos" className={styles.photos}>
      {photos.map((p, i) => (
        <li key={p.id} className={styles.photo}>
          <a href={p.href} target="_blank" rel="noreferrer">
            {/* Signed redirect to private storage: no next/image optimiser in between. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbHref} alt={`Photo ${i + 1} of ${photos.length}`} loading="lazy" className={styles.photoImage} />
          </a>
          {remove ? (
            <ActionForm
              action={action}
              inline
              variant="ghost"
              submit="Remove photo"
              confirm="Remove this photo?"
              fields={{ op: 'removePostPhoto', postId, photoId: p.id }}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
