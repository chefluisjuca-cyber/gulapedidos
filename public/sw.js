// ── Install / activate: claim clients immediately ─────────────────
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// ── Fetch handler: network-first, fallback to cache ────────────────
// Required for PWA installability criteria. We use a network-first
// strategy so the app always gets fresh content when online, but
// falls back to cache when offline.
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        const copy = response.clone();
        caches.open('gula-v1').then(function(cache) {
          cache.put(event.request, copy).catch(function() {});
        });
        return response;
      })
      .catch(function() {
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
  );
});

// ── Push notifications (server-side) ──────────────────────────────
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Gula Pedidos';
  const options = {
    body: data.body || '',
    icon: '/gula-pedidos-digial.png',
    badge: '/gula-pedidos-digial.png',
    tag: data.tag || 'gula-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: data.url ? { url: data.url } : { url: '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: focus or open the main window ──────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to focus an existing tab
      for (const client of clientList) {
        if (client.url.includes(targetUrl) || 'focus' in client) {
          return client.focus();
        }
      }
      // No existing tab — open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Message from page: trigger notification from the SW ────────────
// This allows the page to ask the SW to show a notification, which works
// even when the tab is minimized (SW stays alive longer than the page).
self.addEventListener('message', function(event) {
  const data = event.data || {};
  if (data.type === 'SHOW_NOTIFICATION') {
    const title = data.title || 'Gula Pedidos';
    const options = {
      body: data.body || '',
      icon: '/gula-pedidos-digial.png',
      badge: '/gula-pedidos-digial.png',
      tag: data.tag || 'gula-order',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: data.url ? { url: data.url } : { url: '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// ── Periodic sync (if supported) ───────────────────────────────────
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'check-orders') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        clientList.forEach(client => {
          client.postMessage({ type: 'CHECK_ORDERS' });
        });
      })
    );
  }
});

// ── Keep the service worker alive ──────────────────────────────────
// The SW can be killed by the browser when idle. We use a heartbeat
// via the page to keep it alive while the page is open.
self.addEventListener('message', function(event) {
  if (event.data?.type === 'KEEPALIVE') {
    // Just respond — the act of messaging keeps the SW alive
    if (event.source) {
      event.source.postMessage({ type: 'KEEPALIVE_ACK' });
    }
  }
});
