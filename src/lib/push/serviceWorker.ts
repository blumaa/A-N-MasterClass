// Push service worker source, served per space host by app/[space]/push-sw.js/route.ts.
// Plain ES5-ish JS: it runs in the worker, never bundled. Ported from kinbaku-study-group
// public/push-sw.js. Every url is forced onto the worker's own origin (the space host):
// WindowClient.navigate() throws on cross-origin urls, and a push may only open its own space.
// A tap is parked in Cache Storage first (iOS cold start; see pendingTap.ts). The cache name and
// key are copies of PENDING_TAP_CACHE / PENDING_TAP_KEY; the tests hold them together.
export const SERVICE_WORKER = `
function targetUrl(raw) {
  var origin = self.location.origin;
  try {
    var url = new URL(raw || '/', origin);
    return origin + url.pathname + url.search + url.hash;
  } catch (e) {
    return origin + '/';
  }
}

var PENDING_TAP_CACHE = 'masterclass-notification-tap';
var PENDING_TAP_KEY = '/__masterclass/notification-tap';

// Never rejects: Cache Storage is missing in Safari private browsing, and a tap still has to open.
function parkTap(url) {
  if (!self.caches) return Promise.resolve();
  return self.caches.open(PENDING_TAP_CACHE).then(function (cache) {
    return cache.put(PENDING_TAP_KEY, new Response(JSON.stringify({ url: url, ts: Date.now() })));
  }).catch(function () { return undefined; });
}

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  var options = { body: data.body || '', data: { url: targetUrl(data.url) } };
  if (data.icon) options.icon = data.icon;
  event.waitUntil(self.registration.showNotification(data.title || 'Notification', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = targetUrl(event.notification.data && event.notification.data.url);
  // Parked first and awaited: an app that boots before the write lands reads an empty cache.
  event.waitUntil(parkTap(url).then(function () {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var client = list[i];
      if ('focus' in client) {
        // navigate() works on Android and desktop; a standalone iOS PWA ignores it, so the
        // message lets the app route itself (NotificationTap). Same address either way.
        if ('postMessage' in client) client.postMessage({ type: 'navigate', url: url });
        if ('navigate' in client) client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
`;
