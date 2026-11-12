import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const sendNotification = vi.fn(async () => ({ statusCode: 201, body: '', headers: {} }));
vi.mock('web-push', () => ({ sendNotification }));

const { webPushSender } = await import('./webPushSender');

describe('webPushSender', () => {
  it('signs each send with the VAPID keys and keeps the message for a day', async () => {
    const send = webPushSender({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ops@masterclass.test' });
    await send({ spaceId: 's', profileId: 'p', endpoint: 'https://push.test/1', p256dh: 'k', auth: 'a', userAgent: null }, '{"title":"t"}');
    expect(sendNotification).toHaveBeenCalledWith({ endpoint: 'https://push.test/1', keys: { p256dh: 'k', auth: 'a' } }, '{"title":"t"}', {
      vapidDetails: { subject: 'mailto:ops@masterclass.test', publicKey: 'pub', privateKey: 'priv' },
      TTL: 86400,
      urgency: 'high',
      timeout: 10000,
    });
  });
});
