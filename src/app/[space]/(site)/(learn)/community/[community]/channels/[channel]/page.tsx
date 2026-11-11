// One channel of a community.
import type { Metadata } from 'next';
import { ChannelPage, loadChannel } from '../../ChannelPage';

type Props = PageProps<'/[space]/community/[community]/channels/[channel]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { space, community, channel } = await params;
  const data = await loadChannel(space, community, channel);
  return data?.page.kind === 'open' ? { title: `${data.page.channel.title} · ${data.page.community.title}` } : {};
}

export default async function ChannelRoute({ params }: Props) {
  const { space, community, channel } = await params;
  return <ChannelPage space={space} community={community} channelId={channel} />;
}
