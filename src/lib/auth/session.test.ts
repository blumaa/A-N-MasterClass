// The session is request data: reading it must stop prerendering in every mode, or an auth-gated
// page gets baked at build time (the /platform redirect was built as a static page in CI).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const order: string[] = [];

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ connection: vi.fn(async () => void order.push('connection')) }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => {
    order.push('cookies');
    return { get: () => undefined };
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({ adminClient: vi.fn() }));
vi.mock('@/lib/supabase/auth/signInAs', () => ({ signInAs: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ userClient: vi.fn() }));

describe('sessionProfileId', () => {
  beforeEach(() => {
    order.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('waits for the request even when dev login is off (production build, fake data)', async () => {
    vi.stubEnv('DATA_SOURCE', 'fake');
    vi.stubEnv('NODE_ENV', 'production');
    const { sessionProfileId } = await import('./session');
    expect(await sessionProfileId()).toBeNull();
    expect(order).toEqual(['connection']);
  });

  it('waits for the request before reading the dev cookie', async () => {
    vi.stubEnv('DATA_SOURCE', 'fake');
    vi.stubEnv('NODE_ENV', 'development');
    const { sessionProfileId } = await import('./session');
    expect(await sessionProfileId()).toBeNull();
    expect(order).toEqual(['connection', 'cookies']);
  });
});
