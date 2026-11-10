// Platform host SSOT (G17). Only module that reads PLATFORM_HOST.
// Dev: `localhost` (spaces at <slug>.localhost). Prod: real domain once bought.

type Env = Record<string, string | undefined>;

const BARE_HOST = /^[a-z0-9.-]+$/;

export function readPlatformHost(env: Env): string {
  const host = env.PLATFORM_HOST?.trim().toLowerCase() ?? '';
  if (!BARE_HOST.test(host)) {
    throw new Error(`PLATFORM_HOST must be a bare host name (no scheme, port or path); got ${JSON.stringify(env.PLATFORM_HOST)}`);
  }
  return host;
}

export const platformHost = (): string => readPlatformHost(process.env);
