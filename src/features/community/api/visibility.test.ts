import { describe, expect, it } from 'vitest';
import type { Post } from '@/lib/data/types';
import { inFeed, postOpen, seesPost } from './visibility';

const NOW = new Date('2026-11-10T12:00:00Z');
const post = (over: Partial<Post> = {}): Post => ({
  id: 'p',
  channelId: 'c',
  authorId: 'author',
  body: 'b',
  createdAt: NOW,
  pinned: false,
  hiddenAt: null,
  lockedAt: null,
  status: 'published',
  ...over,
});

describe('inFeed', () => {
  it('shows published posts, and pending or rejected ones to their author only', () => {
    expect(inFeed(post(), 'x')).toBe(true);
    expect(inFeed(post({ status: 'pending' }), 'x')).toBe(false);
    expect(inFeed(post({ status: 'rejected' }), 'author')).toBe(true);
    expect(inFeed(post({ hiddenAt: NOW }), 'author')).toBe(false);
  });
});

describe('seesPost', () => {
  it('moderators see every post; others what the feed shows', () => {
    expect(seesPost(true, post({ hiddenAt: NOW, status: 'pending' }), 'x')).toBe(true);
    expect(seesPost(false, post({ status: 'pending' }), 'author')).toBe(true);
    expect(seesPost(false, post({ status: 'pending' }), null)).toBe(false);
  });
});

describe('postOpen', () => {
  it('takes comments when published and not locked', () => {
    expect(postOpen(post())).toBe(true);
    expect(postOpen(post({ lockedAt: NOW }))).toBe(false);
    expect(postOpen(post({ status: 'pending' }))).toBe(false);
  });
});
