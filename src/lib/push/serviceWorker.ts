// Push service worker source, served per space host by app/[space]/push-sw.js/route.ts.
// Plain ES5-ish JS: it runs in the worker, never bundled. Ported from kinbaku-study-group
// public/push-sw.js. Every url is forced onto the worker's own origin (the space host):
// WindowClient.navigate() throws on cross-origin urls, and a push may only open its own space.
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

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Notification', {
    body: data.body || '',
    data: { url: targetUrl(data.url) }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = targetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var client = list[i];
      if ('focus' in client) {
        if ('navigate' in client) client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
`;
