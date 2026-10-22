/* Service worker de MYRESTO.
 *
 * Il fait UNE chose : si le téléphone n'a plus de réseau quand on ouvre une page, il affiche une page « Pas de connexion »
 * plutôt que l'écran d'erreur du navigateur. Il ne garde JAMAIS en mémoire les pages ni les données de l'appli (réservations,
 * équipe, finances… restent privées et toujours à jour) : seuls cette page et l'icône sont mis de côté.
 */
const CACHE = "myresto-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Seules les ouvertures de page sont concernées ; tout le reste passe directement par le réseau.
  if (request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
