// Blog index: published posts, newest first.
import { EmptyState, ListGroup } from '@/components/ui/mds';
import { LinkRow } from '@/components/ui/links';
import type { Page } from '@/lib/data/types';
import { formatDate } from '@/lib/format/date';
import { pageHref } from '../paths';

export function BlogList({ posts }: { posts: Page[] }) {
  if (posts.length === 0) return <EmptyState title="No posts yet" description="New posts show up here." />;
  return (
    <ListGroup>
      {posts.map((post) => (
        <LinkRow
          key={post.id}
          href={pageHref(post)}
          title={post.title}
          description={post.seoDescription ?? (post.publishedAt ? formatDate(post.publishedAt) : undefined)}
        />
      ))}
    </ListGroup>
  );
}
