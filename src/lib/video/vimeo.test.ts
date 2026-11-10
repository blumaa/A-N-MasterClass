import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchVimeoMeta, vimeoIdOf, VimeoRefusal, vimeoPlayerUrl } from './vimeo';

describe('vimeoIdOf', () => {
  it.each([
    ['https://vimeo.com/76979871', '76979871'],
    ['vimeo.com/76979871', '76979871'],
    ['https://www.vimeo.com/76979871/', '76979871'],
    ['https://vimeo.com/76979871?share=copy', '76979871'],
    ['https://vimeo.com/76979871/abcdef0123', '76979871'],
    ['https://player.vimeo.com/video/76979871?h=abc', '76979871'],
    ['https://vimeo.com/manage/videos/76979871', '76979871'],
    ['https://vimeo.com/manage/videos/76979871/privacy', '76979871'],
    ['  76979871  ', '76979871'],
  ])('reads the id out of %s', (typed, id) => {
    expect(vimeoIdOf(typed)).toBe(id);
  });

  it.each([
    '',
    'https://youtube.com/watch?v=76979871',
    'https://vimeo.com/channels/staffpicks',
    'https://vimeo.com/',
    'https://notvimeo.com/76979871',
    'https://vimeo.com.evil.test/76979871',
    'not a link',
    'https://vimeo.com/abc',
  ])('refuses %s', (typed) => {
    expect(vimeoIdOf(typed)).toBeNull();
  });
});

describe('vimeoPlayerUrl', () => {
  it('is the player, with tracking off', () => {
    expect(vimeoPlayerUrl('76979871')).toBe('https://player.vimeo.com/video/76979871?dnt=1');
  });
});

describe('fetchVimeoMeta', () => {
  const fetched = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetched);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const answer = (body: unknown, status = 200) =>
    fetched.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('asks oEmbed about the share link, and reads back what the row and the card need', async () => {
    answer({ title: 'Big Buck Bunny', width: 1280, height: 720, duration: 597, thumbnail_url: 'https://i.vimeocdn.com/video/x-d_1280' });

    await expect(fetchVimeoMeta('1084537')).resolves.toEqual({
      title: 'Big Buck Bunny',
      aspect: 1280 / 720,
      duration: 597,
      thumbnailUrl: 'https://i.vimeocdn.com/video/x-d_1280',
    });
    expect(fetched.mock.calls[0]?.[0]).toBe(
      'https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F1084537&width=1280',
    );
  });

  it.each([403, 404])('names a %s as Vimeo refusing, which is the admin’s setting to fix', async (status) => {
    answer('Not Found', status);

    await expect(fetchVimeoMeta('1')).rejects.toBeInstanceOf(VimeoRefusal);
  });

  it('throws plainly on any other answer, which is worth trying again', async () => {
    answer('', 502);

    await expect(fetchVimeoMeta('1')).rejects.not.toBeInstanceOf(VimeoRefusal);
  });
});
