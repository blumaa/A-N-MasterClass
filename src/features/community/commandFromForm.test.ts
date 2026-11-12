import { describe, expect, it } from 'vitest';
import { chatCommandFromForm, communityCommandFromForm, reportCommandFromForm, studioCommunityCommandFromForm } from './commandFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

const FILE = { attachmentPath: 's/c/ch/u-a.pdf', attachmentName: 'A.pdf', attachmentType: 'application/pdf', attachmentSize: '12' };

describe('chat attachments', () => {
  it('a line takes a file, with or without text', () => {
    expect(chatCommandFromForm(form({ op: 'sendMessage', channelId: 'ch', body: '', ...FILE }))).toEqual({
      ok: true,
      command: { op: 'sendMessage', channelId: 'ch', body: '', attachment: { path: 's/c/ch/u-a.pdf', name: 'A.pdf', type: 'application/pdf', size: 12 } },
    });
    expect(chatCommandFromForm(form({ op: 'sendDm', threadId: 't', body: 'see', ...FILE }))).toMatchObject({
      command: { body: 'see', attachment: { size: 12 } },
    });
  });

  it('a line without a file still needs text; a bad size is refused', () => {
    expect(chatCommandFromForm(form({ op: 'sendMessage', channelId: 'ch', body: '' }))).toEqual({ ok: false, message: 'Write something first.' });
    expect(chatCommandFromForm(form({ op: 'sendMessage', channelId: 'ch', body: '', ...FILE, attachmentSize: 'x' }))).toEqual({
      ok: false,
      message: 'The file size is not valid.',
    });
  });
});

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

  it('reads post photos, and photo edits', () => {
    const f = form({ op: 'createPost', channelId: 'ch', body: 'hi' });
    f.append('photo', 'a.jpg');
    f.append('photo', 'b.jpg');
    expect(communityCommandFromForm(f)).toEqual({
      ok: true,
      command: { op: 'createPost', channelId: 'ch', body: 'hi', photos: ['a.jpg', 'b.jpg'] },
    });
    const add = form({ op: 'addPostPhotos', postId: 'p', photo: 'c.jpg' });
    expect(communityCommandFromForm(add)).toEqual({ ok: true, command: { op: 'addPostPhotos', postId: 'p', photos: ['c.jpg'] } });
    expect(communityCommandFromForm(form({ op: 'addPostPhotos', postId: 'p' }))).toEqual({ ok: false, message: 'Add a photo first.' });
    expect(communityCommandFromForm(form({ op: 'removePostPhoto', postId: 'p', photoId: 'ph' }))).toEqual({
      ok: true,
      command: { op: 'removePostPhoto', postId: 'p', photoId: 'ph' },
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
    expect(studioCommunityCommandFromForm(form({ op: 'updateChannel', channelId: 'ch', privacy: 'private', readOnly: 'true' }))).toEqual({
      ok: true,
      command: { op: 'updateChannel', channelId: 'ch', patch: { privacy: 'private', readOnly: true } },
    });
    expect(studioCommunityCommandFromForm(form({ op: 'updateGroup', groupId: 'g', dms: 'false' }))).toEqual({
      ok: true,
      command: { op: 'updateGroup', groupId: 'g', patch: { dms: false } },
    });
  });

  it('reads channel create, move and staff ticks', () => {
    const channel = { op: 'createChannel', communityId: 'c', title: 'Wins', kind: 'chat', privacy: 'public', readOnly: 'false' };
    expect(studioCommunityCommandFromForm(form({ ...channel, accessGroupId: 'g' }))).toEqual({
      ok: true,
      command: { ...channel, readOnly: false, accessGroupId: 'g' },
    });
    expect(studioCommunityCommandFromForm(form({ ...channel, accessGroupId: '' }))).toEqual({
      ok: true,
      command: { ...channel, readOnly: false },
    });
    expect(studioCommunityCommandFromForm(form({ op: 'moveChannel', channelId: 'ch', direction: 'down' }))).toMatchObject({ ok: true });
    expect(studioCommunityCommandFromForm(form({ op: 'setStaff', communityId: 'c', profileId: 'p', on: 'true' }))).toEqual({
      ok: true,
      command: { op: 'setStaff', communityId: 'c', profileId: 'p', on: true },
    });
    expect(studioCommunityCommandFromForm(form({ ...channel, privacy: 'secret' })).ok).toBe(false);
  });

  it('reads groups, private channel members and DM settings', () => {
    expect(studioCommunityCommandFromForm(form({ op: 'createGroup', communityId: 'c', title: 'VIP' }))).toMatchObject({ ok: true });
    expect(studioCommunityCommandFromForm(form({ op: 'deleteGroup', groupId: 'g' }))).toMatchObject({ ok: true });
    expect(studioCommunityCommandFromForm(form({ op: 'setChannelMember', channelId: 'ch', profileId: 'p', on: 'true' }))).toEqual({
      ok: true,
      command: { op: 'setChannelMember', channelId: 'ch', profileId: 'p', on: true },
    });
    expect(studioCommunityCommandFromForm(form({ op: 'saveSettings', communityId: 'c', dmsEnabled: 'true', founderDms: 'false' }))).toEqual({
      ok: true,
      command: { op: 'saveSettings', communityId: 'c', patch: { dmsEnabled: true, founderDms: false } },
    });
  });

  it('reads channel moderator picks', () => {
    expect(studioCommunityCommandFromForm(form({ op: 'setChannelModerator', channelId: 'ch', profileId: 'p', on: 'false' }))).toEqual({
      ok: true,
      command: { op: 'setChannelModerator', channelId: 'ch', profileId: 'p', on: false },
    });
  });

  it('reads group feature toggles', () => {
    const f = form({ op: 'updateGroup', groupId: 'g', challenges: 'false', meetups: 'true', leaderboard: 'false' });
    expect(studioCommunityCommandFromForm(f)).toEqual({
      ok: true,
      command: { op: 'updateGroup', groupId: 'g', patch: { challenges: false, meetups: true, leaderboard: false } },
    });
  });

  it('reads points settings: toggle, leaderboard visibility, whole point values 0..1000', () => {
    const points = { op: 'saveSettings', communityId: 'c', pointsEnabled: 'true', leaderboard: 'staff', point_comment: '5', point_dm: '0' };
    expect(studioCommunityCommandFromForm(form(points))).toEqual({
      ok: true,
      command: { op: 'saveSettings', communityId: 'c', patch: { pointsEnabled: true, leaderboard: 'staff', pointValues: { comment: 5, dm: 0 } } },
    });
    expect(studioCommunityCommandFromForm(form({ ...points, leaderboard: 'everyone' })).ok).toBe(false);
    expect(studioCommunityCommandFromForm(form({ ...points, point_comment: '1.5' })).ok).toBe(false);
    expect(studioCommunityCommandFromForm(form({ ...points, point_comment: '1001' })).ok).toBe(false);
    expect(studioCommunityCommandFromForm(form({ ...points, point_comment: '-1' })).ok).toBe(false);
  });
});

describe('chatCommandFromForm', () => {
  it('reads messages, DMs and blocks', () => {
    expect(chatCommandFromForm(form({ op: 'sendMessage', channelId: 'ch', body: 'hi' }))).toEqual({
      ok: true,
      command: { op: 'sendMessage', channelId: 'ch', body: 'hi' },
    });
    expect(chatCommandFromForm(form({ op: 'sendDm', threadId: 't', body: '' })).ok).toBe(false);
    expect(chatCommandFromForm(form({ op: 'startDm', communityId: 'c', recipientId: 'p' }))).toMatchObject({ ok: true });
    expect(chatCommandFromForm(form({ op: 'deleteMessage', messageId: 'm' }))).toMatchObject({ ok: true });
    expect(chatCommandFromForm(form({ op: 'block', communityId: 'c', profileId: 'p', on: 'true' }))).toEqual({
      ok: true,
      command: { op: 'block', communityId: 'c', profileId: 'p', on: true },
    });
  });
});

describe('reportCommandFromForm', () => {
  it('reads a report; blank reason is none', () => {
    expect(reportCommandFromForm(form({ op: 'report', targetType: 'comment', targetId: 'c', reason: ' rude ' }))).toEqual({
      ok: true,
      command: { op: 'report', targetType: 'comment', targetId: 'c', reason: 'rude' },
    });
    expect(reportCommandFromForm(form({ op: 'report', targetType: 'message', targetId: 'm', reason: '' }))).toMatchObject({
      command: { reason: null },
    });
    expect(reportCommandFromForm(form({ op: 'report', targetType: 'step', targetId: 's' }))).toMatchObject({ ok: false });
  });

  it('reads a resolution', () => {
    expect(reportCommandFromForm(form({ op: 'resolveReport', reportId: 'r', action: 'remove' }))).toEqual({
      ok: true,
      command: { op: 'resolveReport', reportId: 'r', action: 'remove' },
    });
    expect(reportCommandFromForm(form({ op: 'resolveReport', reportId: 'r', action: 'ban' }))).toMatchObject({ ok: false });
  });
});
