/**
 * OrangeCat Service Worker
 * Provides offline functionality, caching, and push notifications
 */

const CACHE_NAME = 'orangecat-v1.3.0';

// Static assets to cache immediately
// `/offline` removed — no offline page route exists in the app (only the
// messaging offline-queue module shares the name). If/when an offline
// fallback page is added at src/app/offline/page.tsx, re-add it here and
// re-introduce OFFLINE_URL plus the fetch-handler fallback.
const STATIC_CACHE_URLS = [
  '/',
  '/discover',
  '/auth',
  '/about',
  '/manifest.json',
  '/images/orange-cat-logo.svg',
];

// API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [/^\/api\/health/, /^\/api\/profile/, /^\/api\/funding/];

// Image patterns to cache
const IMAGE_CACHE_PATTERNS = [/\.(?:png|jpg|jpeg|svg|gif|webp)$/, /^\/images\//, /^\/icons\//];

// Network-first patterns (always try network, fallback to cache)
const NETWORK_FIRST_PATTERNS = [/^\/api\//, /^\/auth/];

// Cache-first patterns (use cache if available)
// NOTE: JavaScript files are excluded from cache-first to prevent stale code issues
// In development, JS files should always come from network
const CACHE_FIRST_PATTERNS = [...IMAGE_CACHE_PATTERNS, /\.(?:css|woff|woff2|ttf|eot)$/];

// =====================================================================
// INSTALL EVENT - Cache static assets
// =====================================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Cache static URLs
      try {
        await cache.addAll(STATIC_CACHE_URLS);
        console.log('[SW] Static assets cached successfully');
      } catch (error) {
        console.warn('[SW] Failed to cache some static assets:', error);
        // Cache individually to avoid failing on single broken URL
        for (const url of STATIC_CACHE_URLS) {
          try {
            await cache.add(url);
          } catch (urlError) {
            console.warn(`[SW] Failed to cache ${url}:`, urlError);
          }
        }
      }

      // Skip waiting to activate immediately
      self.skipWaiting();
    })()
  );
});

// =====================================================================
// ACTIVATE EVENT - Clean up old caches
// =====================================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('orangecat-') && cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );

      // Take control of all pages
      self.clients.claim();
      console.log('[SW] Service worker activated and ready!');
    })()
  );
});

// =====================================================================
// FETCH EVENT - Handle requests with caching strategies
// =====================================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Only handle GET requests in the service worker
  // Avoid caching POST/PUT/PATCH/DELETE to prevent Cache API errors
  if (request.method !== 'GET') {
    return;
  }

  // Skip requests to different origins (unless API)
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api')) {
    return;
  }

  event.respondWith(handleRequest(request));
});

// =====================================================================
// REQUEST HANDLING STRATEGIES
// =====================================================================

async function handleRequest(request) {
  const url = new URL(request.url);

  try {
    // Brand files keep stable paths across releases. Never pin an old logo
    // in cache-first storage; the manifest carries content-versioned icon URLs.
    if (
      [
        '/manifest.json',
        '/favicon.svg',
        '/favicon.ico',
        '/apple-icon.png',
        '/images/orange-cat-logo.svg',
      ].includes(url.pathname) ||
      url.pathname.startsWith('/icons/')
    ) {
      return await networkFirst(request);
    }

    // 1. Network-first strategy (APIs, auth)
    if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await networkFirst(request);
    }

    // 2. JavaScript files: Always network-first in development, never cache
    // This prevents stale code from being served after updates
    if (/\.js$/.test(url.pathname)) {
      try {
        const response = await fetch(request);
        // Don't cache JS files to ensure fresh code
        return response;
      } catch (error) {
        // If network fails, try cache as fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      }
    }

    // 3. Cache-first strategy (static assets, but NOT JS)
    if (CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await cacheFirst(request);
    }

    // 4. Load the current app shell on launch; use the saved shell only offline.
    if (request.mode === 'navigate') {
      return await networkFirst(request);
    }

    // 5. Default: network-first
    return await networkFirst(request);
  } catch (error) {
    console.warn('[SW] Request failed:', url.pathname, error);
    return await getOfflineFallback(request);
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (request.method === 'GET' && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Cache-first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // If not in cache, fetch and cache
  try {
    const response = await fetch(request);
    if (request.method === 'GET' && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    throw error;
  }
}

// Offline fallback
async function getOfflineFallback(request) {
  if (request.mode === 'navigate') {
    // No /offline route exists in the app, so we always return the inline
    // HTML fallback below. Earlier code attempted `caches.match('/offline')`
    // first, but that lookup never resolved (the page was never cached) so
    // the inline fallback was effectively the only path. Dropping the
    // useless cache-match keeps the same observable behavior.
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OrangeCat - Offline</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              padding: 2rem; 
              text-align: center; 
              background: linear-gradient(135deg, #f7931a20 0%, #00d4aa20 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            h1 { color: #f7931a; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 2rem; }
            button { 
              background: #f7931a; 
              color: white; 
              border: none; 
              padding: 0.75rem 1.5rem; 
              border-radius: 0.5rem; 
              cursor: pointer;
              font-size: 1rem;
            }
            button:hover { background: #e8830f; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🟠 OrangeCat</h1>
            <h2>You're Offline</h2>
            <p>It looks like you're not connected to the internet. Some features may not be available.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
      `,
      {
        headers: { 'Content-Type': 'text/html' },
        status: 200,
      }
    );
  }

  // For other requests, return a simple error response
  return new Response(
    JSON.stringify({ error: 'Offline', message: 'This feature requires an internet connection' }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    }
  );
}

// =====================================================================
// PUSH NOTIFICATIONS
// =====================================================================
self.addEventListener('push', event => {
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    // Icon/badge fields removed — public/icons/* PNGs referenced previously
    // (icon-192x192.png, badge-72x72.png, action-view.png, action-dismiss.png)
    // do not exist in the repo. Notifications fall back to the default
    // browser icon. When push gets wired (booking notifications phase 2),
    // generate PNGs from the brand mark and restore icon/badge/action.icon.
    const options = {
      body: data.body || 'New update from OrangeCat',
      tag: data.tag || 'orangecat-notification',
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      data: {
        url: data.url || '/',
        timestamp: Date.now(),
      },
    };

    event.waitUntil(self.registration.showNotification(data.title || 'OrangeCat', options));
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Check if there's already a window open with this URL
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// =====================================================================
// BACKGROUND SYNC (for when connection is restored)
// =====================================================================
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('[SW] Background sync triggered');
  // Implement any background sync logic here
  // e.g., upload pending transactions, sync profile data, etc.
}

// =====================================================================
// PERIODIC BACKGROUND SYNC (for updates)
// =====================================================================
self.addEventListener('periodicsync', event => {
  if (event.tag === 'periodic-sync') {
    event.waitUntil(doPeriodicSync());
  }
});

async function doPeriodicSync() {
  console.log('[SW] Periodic sync triggered');
  // Implement periodic sync logic here
  // e.g., check for campaign updates, fetch new featured projects
}

console.log('[SW] Service worker script loaded');
