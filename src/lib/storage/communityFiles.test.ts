import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_TYPES,
  channelFolder,
  communityFilePath,
  COMMUNITY_MAX_BYTES,
  communityFileProblem,
  isImageType,
  threadFolder,
} from './communityFiles';
import { inFolder } from './uploadPath';

describe('community folders', () => {
  it('feed and chat files sit in the channel folder, DM files in the thread folder', () => {
    expect(channelFolder('s', 'c', 'ch')).toBe('s/c/ch/');
    expect(threadFolder('s', 'c', 't')).toBe('s/c/dm/t/');
    expect(communityFilePath('s/c/ch/', 'u1', 'My Photo.JPG')).toBe('s/c/ch/u1-my-photo.jpg');
  });

  it('inFolder accepts one object directly inside', () => {
    expect(inFolder('s/c/ch/u1-a.jpg', 's/c/ch/')).toBe(true);
    expect(inFolder('s/c/ch/x/u1-a.jpg', 's/c/ch/')).toBe(false);
    expect(inFolder('s/c/ch/', 's/c/ch/')).toBe(false);
    expect(inFolder('s/c/other/u1-a.jpg', 's/c/ch/')).toBe(false);
  });
});

describe('communityFileProblem', () => {
  it('photos: images up to the photo cap', () => {
    expect(communityFileProblem('photo', 'image/jpeg', 1000)).toBeNull();
    expect(communityFileProblem('photo', 'application/pdf', 1000)).toBe('Photos must be JPEG, PNG, WebP or GIF images.');
    expect(communityFileProblem('photo', 'image/jpeg', 0)).toBe('The file is empty.');
    expect(communityFileProblem('photo', 'image/jpeg', 11 * 1024 * 1024)).toMatch(/too large/);
  });

  it('attachments: common file types up to the bucket cap', () => {
    expect(communityFileProblem('attachment', 'application/pdf', COMMUNITY_MAX_BYTES)).toBeNull();
    expect(communityFileProblem('attachment', 'application/x-msdownload', 10)).toBe('This file type is not allowed.');
    expect(communityFileProblem('attachment', 'application/pdf', COMMUNITY_MAX_BYTES + 1)).toMatch(/too large/);
    expect(ATTACHMENT_TYPES).toContain('image/png');
  });

  it('isImageType', () => {
    expect(isImageType('image/webp')).toBe(true);
    expect(isImageType('application/pdf')).toBe(false);
  });
});
