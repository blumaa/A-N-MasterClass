import { describe, expect, it } from 'vitest';
import { headersOrigin, platformOrigin, requestOrigin, spaceOrigin } from './origin';

describe('requestOrigin', () => {
  it('uses the forwarded protocol when present', () => {
    expect(requestOrigin('alexander.example.com', 'https')).toBe('https://alexander.example.com');
    expect(requestOrigin('alexander.localhost:3000', 'http')).toBe('http://alexander.localhost:3000');
  });

  it('defaults to http on localhost and https elsewhere', () => {
    expect(requestOrigin('alexander.localhost:3000', null)).toBe('http://alexander.localhost:3000');
    expect(requestOrigin('alexander.example.com', null)).toBe('https://alexander.example.com');
  });
});

describe('headersOrigin', () => {
  it('builds the origin from the forwarded host and protocol', () => {
    const h = new Headers({ host: 'localhost:3000', 'x-forwarded-host': 'alexander.localhost:3000' });
    expect(headersOrigin(h)).toBe('http://alexander.localhost:3000');
    expect(headersOrigin(new Headers({ host: 'alexander-ma.com', 'x-forwarded-proto': 'https' }))).toBe('https://alexander-ma.com');
  });
});

describe('platformOrigin', () => {
  it('swaps the host name for the platform host, keeping protocol and port', () => {
    expect(platformOrigin('http://alexander.localhost:3000', 'localhost')).toBe('http://localhost:3000');
    expect(platformOrigin('https://alexander-ma.com', 'masterclass.example')).toBe('https://masterclass.example');
  });
});

describe('spaceOrigin', () => {
  it('puts the slug in front of the platform host, keeping protocol and port', () => {
    expect(spaceOrigin('http://localhost:3000', 'fiddle')).toBe('http://fiddle.localhost:3000');
    expect(spaceOrigin('https://masterclass.example', 'fiddle')).toBe('https://fiddle.masterclass.example');
  });
});
