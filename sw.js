/* =====================================================
   Household Finance — sw.js (Service Worker)
   General version with Push Notification support
   ===================================================== */

const CACHE_NAME = "household-finance-v1";

// File yang di-cache untuk offline
const CACHE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
];

// ─── Install: cache semua aset ────────────────────────
self.addEventListener("install", event => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn("[SW] Cache addAll error:", err))
  );
});

// ─── Activate: hapus cache lama ───────────────────────
self.addEventListener("activate", event => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log("[SW] Deleting old cache:", k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: Network-first untuk GAS, Cache-first untuk aset ──
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // GAS API: selalu dari network
  if (url.includes("script.google.com")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ status: "ERROR", message: "Offline" }), {
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    return;
  }

  // Aset lokal: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});

// ─── Push Notification ────────────────────────────────
self.addEventListener("push", event => {
  console.log("[SW] Push received");

  // Default fallback — judul & isi diambil dari payload OneSignal
  let data = { title: "Household Finance", body: "Ada notifikasi baru" };

  try {
    if (event.data) data = event.data.json();
  } catch(_) {
    data.body = event.data ? event.data.text() : "Ada notifikasi baru";
  }

  const options = {
    body:    data.body    || "Ada notifikasi baru",
    icon:    "./assets/icons/icon-192.png",
    badge:   "./assets/icons/icon-192.png",
    vibrate: [200, 100, 200, 100, 200],
    tag:     data.tag     || "hf-push",
    data:    { url: data.url || self.registration.scope },
    actions: [
      { action: "open",    title: "Buka App" },
      { action: "dismiss", title: "Tutup"    }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Household Finance", options)
  );
});

// ─── Notification Click ───────────────────────────────
self.addEventListener("notificationclick", event => {
  console.log("[SW] Notification clicked:", event.action);
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ─── Background Sync ──────────────────────────────────
self.addEventListener("sync", event => {
  if (event.tag === "sync-transactions") {
    console.log("[SW] Background sync: sync-transactions");
  }
});

// ─── Message dari client ──────────────────────────────
self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
