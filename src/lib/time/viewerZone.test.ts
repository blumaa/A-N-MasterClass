import { describe, expect, it } from 'vitest';
import { pickViewerZone, VIEWER_ZONE_COOKIE, VIEWER_ZONE_SCRIPT } from './viewerZone';

describe('pickViewerZone', () => {
  it('uses a known IANA zone from the cookie', () => {
    expect(pickViewerZone('Asia/Tokyo', 'Europe/Berlin')).toBe('Asia/Tokyo');
  });

  it('falls back when the cookie is missing or not a zone', () => {
    expect(pickViewerZone(undefined, 'Europe/Berlin')).toBe('Europe/Berlin');
    expect(pickViewerZone('', 'Europe/Berlin')).toBe('Europe/Berlin');
    expect(pickViewerZone('Mars/Olympus', 'Europe/Berlin')).toBe('Europe/Berlin');
  });
});

describe('VIEWER_ZONE_SCRIPT', () => {
  it('stores the browser zone in the cookie', () => {
    document.cookie = `${VIEWER_ZONE_COOKIE}=; max-age=0; path=/`;
    new Function(VIEWER_ZONE_SCRIPT)();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(document.cookie).toContain(`${VIEWER_ZONE_COOKIE}=${zone}`);
  });
});
