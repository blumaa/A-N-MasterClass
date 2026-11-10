import { describe, expect, it } from 'vitest';
import { communityCommandFromForm, studioCommunityCommandFromForm } from './commandFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('communityCommandFromForm', () => {
  it('reads a post body as given (mention markup kept)', () => {
    expect(communityCommandFromForm(form({ op: 'createPost', channelId: 'ch', body: 'hi @[Sam](p1)' }))).toEqual({
      ok: true,
      command: { op: 'createPost', channelId: 'ch', body: 'hi @[Sam](p1)' },
    });
  });

  it('refuses an empty body', () => {
    expect(communityCommandFromForm(form({ op: 'createPost', channelId: 'ch', body: '  ' }))).toEqual({
      ok: false,
      message: 'Write something first.',
    });
  });

  it('reads comments on posts and steps, with an optional parent', () => {
    expect(communityCommandFromForm(form({ op: 'createComment', targetType: 'step', targetId: 's', parentId: '', body: 'q' }))).toEqual({
      ok: true,
      command: { op: 'createComment', target: { type: 'step', id: 's' }, parentId: null, body: 'q' },
    });
    expect(communityCommandFromForm(form({ op: 'createComment', targetType: 'post', targetId: 'p', parentId: 'c', body: 'a' }))).toMatchObject({
      command: { parentId: 'c' },
    });
  });

  it('reads booleans for hide, pin and react', () => {
    expect(communityCommandFromForm(form({ op: 'pinPost', postId: 'p', pinned: 'true' }))).toEqual({
      ok: true,
      command: { op: 'pinPost', postId: 'p', pinned: true },
    });
    expect(communityCommandFromForm(form({ op: 'react', targetType: 'comment', targetId: 'c', emoji: '🔥', on: 'false' }))).toEqual({
      ok: true,
      command: { op: 'react', target: { type: 'comment', id: 'c' }, emoji: '🔥', on: false },
    });
    expect(communityCommandFromForm(form({ op: 'hideComment', commentId: 'c', hidden: 'maybe' })).ok).toBe(false);
  });
});

describe('studioCommunityCommandFromForm', () => {
  it('derives the community slug from the title', () => {
    expect(studioCommunityCommandFromForm(form({ op: 'createCommunity', title: 'Inner Circle', slug: '' }))).toEqual({
      ok: true,
      command: { op: 'createCommunity', title: 'Inner Circle', slug: 'inner-circle' },
    });
  });

  it('patches only fields sent', () => {
    expect(studioCommunityCommandFromForm(form({ op: 'updateCommunity', communityId: 'c', status: 'published' }))).toEqual({
      ok: true,
      command: { op: 'updateCommunity', communityId: 'c', patch: { status: 'published' } },
    });
    expect(studioCommunityCommandFromForm(form({ op: 'updateChannel', channelId: 'ch', visibility: 'read_only' }))).toEqual({
      ok: true,
      command: { op: 'updateChannel', channelId: 'ch', patch: { visibility: 'read_only' } },
    });
  });

  it('reads channel create, move and staff ticks', () => {
    expect(studioCommunityCommandFromForm(form({ op: 'createChannel', communityId: 'c', title: 'Wins', visibility: 'public' }))).toEqual({
      ok: true,
      command: { op: 'createChannel', communityId: 'c', title: 'Wins', visibility: 'public' },
    });
    expect(studioCommunityCommandFromForm(form({ op: 'moveChannel', channelId: 'ch', direction: 'down' }))).toMatchObject({ ok: true });
    expect(studioCommunityCommandFromForm(form({ op: 'setStaff', communityId: 'c', profileId: 'p', on: 'true' }))).toEqual({
      ok: true,
      command: { op: 'setStaff', communityId: 'c', profileId: 'p', on: true },
    });
    expect(studioCommunityCommandFromForm(form({ op: 'createChannel', communityId: 'c', title: 'X', visibility: 'secret' })).ok).toBe(false);
  });
});
