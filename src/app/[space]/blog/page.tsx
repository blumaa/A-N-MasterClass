// Blog index (G11).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { loadBlog } from '@/features/site/api/load';
import { BlogList } from '@/features/site/components/BlogList';

export const metadata: Metadata = { title: 'Blog' };

export default async function Blog({ params }: PageProps<'/[space]/blog'>) {
  const posts = await loadBlog((await params).space);
  if (!posts) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="display">
        Blog
      </Heading>
      <BlogList posts={posts} />
    </Stack>
  );
}
