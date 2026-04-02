const CACHE_NAME = "dairystream-cache-v2";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Install service worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy: Network first, cache fallback
self.addEventListener("fetch", (event) => {
  // Never try to cache non-GET requests. The Cache API only supports GET.
  if (event.request.method !== "GET") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache only successful GET responses.
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
// ============================================
// Push Notification Events
// ============================================

// Handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push notification with no data");
    return;
  }

  const data = event.data.json();
  const options = {
    body: data.notification?.body || "New notification",
    icon: data.notification?.icon || "/icons/favicon.png",
    badge: data.notification?.badge || "/icons/badge.png",
    vibrate: [200, 100, 200],
    tag: data.data?.deliveryId || "notification",
    requireInteraction: false,
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(
      data.notification?.title || "Dairy Stream",
      options
    )
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl || "/";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Check if already open
      for (const client of clientList) {
        if (client.url === actionUrl && "focus" in client) {
          return client.focus();
        }
      }
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.data);
});
