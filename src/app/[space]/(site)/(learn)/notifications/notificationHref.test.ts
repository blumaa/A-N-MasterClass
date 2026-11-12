import { describe, expect, it } from 'vitest';
import { notificationHref } from './notificationHref';

describe('notificationHref', () => {
  it('maps post, step and report links to their pages', () => {
    expect(notificationHref({ kind: 'post', community: 'circle', postId: 'p1' })).toBe('/community/circle/posts/p1');
    expect(notificationHref({ kind: 'step', program: 'shibari-101', stepId: 's1' })).toBe('/programs/shibari-101/s1');
    expect(notificationHref({ kind: 'reports', community: 'circle' })).toBe('/community/circle/reports');
    expect(notificationHref(null)).toBeNull();
  });
});
