/* Service worker de MYRESTO.
 *
 * Il fait deux choses :
 * 1) afficher les notifications envoyées par l'appli (un message de l'équipe, un horaire modifié…) et ouvrir la bonne page
 *    quand on appuie dessus ;
 * 2) si le téléphone n'a plus de réseau quand on ouvre une page, afficher une page « Pas de connexion » plutôt que l'écran
 *    d'erreur du navigateur. Il ne garde JAMAIS en mémoire les pages ni les données de l'appli (réservations, équipe,
 *    finances… restent privées et toujours à jour) : seuls cette page et l'icône sont mis de côté.
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

// Une notification arrive : on l'affiche telle quelle (texte factuel envoyé par l'appli, rien d'ajouté).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "MYRESTO";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/aujourdhui" },
    })
  );
});

// On appuie sur la notification : on ramène l'appli déjà ouverte vers la bonne page, sinon on l'ouvre.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/aujourdhui";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("navigate" in client && "focus" in client) {
          await client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
