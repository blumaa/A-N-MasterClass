// Blog index: published posts, newest first.
import { EmptyState, ListGroup } from '@/components/ui/mds';
import { LinkRow } from '@/components/ui/links';
import type { PageMeta } from '@/lib/data/types';
import { formatDate } from '@/lib/format/date';
import { pageHref } from '../paths';

/** Date and summary on one line, whichever the post has. */
function summary(post: PageMeta): string | undefined {
  const parts = [post.publishedAt ? formatDate(post.publishedAt) : null, post.seoDescription].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function BlogList({ posts }: { posts: PageMeta[] }) {
  if (posts.length === 0) return <EmptyState title="No posts yet" description="New posts show up here." />;
  return (
    <ListGroup>
      {posts.map((post) => (
        <LinkRow
          key={post.id}
          href={pageHref(post)}
          title={post.title}
          description={summary(post)}
        />
      ))}
    </ListGroup>
  );
}
