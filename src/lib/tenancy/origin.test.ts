import { describe, expect, it } from 'vitest';
import { requestOrigin } from './origin';

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
