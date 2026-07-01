/**
 * Cross-Origin Isolation Service Worker
 *
 * Adds COOP + COEP headers to every response so SharedArrayBuffer is available
 * in the Replit preview pane (which embeds the app in an iframe — the parent
 * frame doesn't have cross-origin isolation, so HTTP headers alone are not
 * enough; the SW must add them on the client side).
 *
 * Based on the well-known coi-serviceworker pattern:
 * https://github.com/gzuidhof/coi-serviceworker
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET/HEAD — pass everything else through untouched.
  if (req.method !== 'GET' && req.method !== 'HEAD') return;

  // Avoid touching no-cors requests to cross-origin resources (e.g. fonts,
  // images loaded via <img>) — rewriting them with credentialless COEP is
  // exactly what the header already does; modifying the Response object would
  // break opaque responses.
  if (req.mode === 'no-cors') return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (
          response.status === 0 ||        // opaque
          !response.url.startsWith('http') // data: / blob: / etc.
        ) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
      .catch(() => fetch(req)),
  );
});
