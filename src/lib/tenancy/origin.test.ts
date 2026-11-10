import { describe, expect, it } from 'vitest';
import { platformOrigin, requestOrigin } from './origin';

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

describe('platformOrigin', () => {
  it('swaps the host name for the platform host, keeping protocol and port', () => {
    expect(platformOrigin('http://alexander.localhost:3000', 'localhost')).toBe('http://localhost:3000');
    expect(platformOrigin('https://alexander-ma.com', 'masterclass.example')).toBe('https://masterclass.example');
  });
});
