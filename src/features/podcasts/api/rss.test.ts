import { describe, expect, it } from 'vitest';
import { podcastRss, type RssChannel } from './rss';

const CHANNEL: RssChannel = {
  title: 'Rope & Talk',
  description: 'Members <only>',
  link: 'https://alexander.test/podcasts/rope-talk',
  language: 'en',
  author: 'Alexander',
  explicit: false,
  order: 'serial',
  items: [
    {
      guid: 'ep-1',
      title: 'Welcome "home"',
      notes: 'Notes',
      pubDate: new Date('2026-11-03T12:00:00Z'),
      url: 'https://alexander.test/feeds/podcast/t/episodes/ep-1',
      bytes: 24_000_000,
      durationS: 1500,
      type: 'full',
      season: 1,
    },
  ],
};

describe('podcastRss', () => {
  it('builds an escaped private RSS 2.0 feed with Apple podcast tags', () => {
    const xml = podcastRss(CHANNEL);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<title>Rope &amp; Talk</title>');
    expect(xml).toContain('<description>Members &lt;only&gt;</description>');
    expect(xml).toContain('<itunes:block>Yes</itunes:block>');
    expect(xml).toContain('<itunes:type>serial</itunes:type>');
    expect(xml).toContain('<itunes:explicit>false</itunes:explicit>');
    expect(xml).toContain('<title>Welcome &quot;home&quot;</title>');
    expect(xml).toContain('<guid isPermaLink="false">ep-1</guid>');
    expect(xml).toContain('<pubDate>Tue, 03 Nov 2026 12:00:00 GMT</pubDate>');
    expect(xml).toContain('<enclosure url="https://alexander.test/feeds/podcast/t/episodes/ep-1" length="24000000" type="audio/mpeg"/>');
    expect(xml).toContain('<itunes:duration>1500</itunes:duration>');
    expect(xml).toContain('<itunes:season>1</itunes:season>');
  });

  it('leaves out unknown duration and season', () => {
    const xml = podcastRss({ ...CHANNEL, items: [{ ...CHANNEL.items[0]!, durationS: null, season: null }] });
    expect(xml).not.toContain('itunes:duration');
    expect(xml).not.toContain('itunes:season');
  });
});
