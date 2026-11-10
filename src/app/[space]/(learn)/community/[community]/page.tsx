// Community home = its first channel (G12).
import type { Metadata } from 'next';
import { ChannelPage, loadChannel } from './ChannelPage';

type Props = PageProps<'/[space]/community/[community]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { space, community } = await params;
  const data = await loadChannel(space, community, null);
  return data ? { title: data.page.community.title } : {};
}

export default async function CommunityHomePage({ params }: Props) {
  const { space, community } = await params;
  return <ChannelPage space={space} community={community} channelId={null} />;
}
