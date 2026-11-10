// Private podcast feed (G18, Kajabi private podcasts): RSS 2.0 with Apple podcast tags.
// itunes:block keeps the feed out of directories; every enclosure URL carries the listener's token.
// Tags per Apple's "Podcast RSS feed requirements".
import type { EpisodeType, PodcastOrder } from '@/lib/data/types';

export type RssItem = {
  guid: string;
  title: string;
  notes: string;
  pubDate: Date;
  url: string;
  bytes: number;
  durationS: number | null;
  type: EpisodeType;
  season: number | null;
};

export type RssChannel = {
  title: string;
  description: string;
  link: string;
  language: string;
  author: string;
  explicit: boolean;
  order: PodcastOrder;
  items: RssItem[];
};

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => ENTITIES[c]!);
const tag = (name: string, value: string): string => `<${name}>${escape(value)}</${name}>`;

function item(i: RssItem): string {
  return [
    '<item>',
    tag('title', i.title),
    `<guid isPermaLink="false">${escape(i.guid)}</guid>`,
    tag('pubDate', i.pubDate.toUTCString()),
    tag('description', i.notes),
    `<enclosure url="${escape(i.url)}" length="${i.bytes}" type="audio/mpeg"/>`,
    i.durationS === null ? '' : tag('itunes:duration', String(i.durationS)),
    tag('itunes:episodeType', i.type),
    i.season === null ? '' : tag('itunes:season', String(i.season)),
    '</item>',
  ].join('');
}

export function podcastRss(c: RssChannel): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
    '<channel>',
    tag('title', c.title),
    tag('description', c.description),
    tag('link', c.link),
    tag('language', c.language),
    tag('itunes:author', c.author),
    tag('itunes:explicit', String(c.explicit)),
    tag('itunes:type', c.order),
    '<itunes:block>Yes</itunes:block>',
    ...c.items.map(item),
    '</channel>',
    '</rss>',
  ].join('\n');
}
