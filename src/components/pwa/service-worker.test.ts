import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/// Fait tourner public/sw.js dans un faux « navigateur » pour vérifier ce qu'il fait — et surtout ce qu'il ne fait pas.
function loadWorker(fetchImpl: (req: unknown) => Promise<unknown>) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const store = new Map<string, unknown>();
  const added: string[] = [];
  const caches = {
    open: async () => ({ addAll: async (urls: string[]) => void added.push(...urls) }),
    keys: async () => [] as string[],
    delete: async () => true,
    match: async (url: string) => (url === "/offline.html" ? "PAGE_HORS_CONNEXION" : undefined),
  };
  const self = { addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn), skipWaiting: () => {}, clients: { claim: async () => {} } };
  vm.runInNewContext(readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8"), { self, caches, fetch: fetchImpl, store });
  return { handlers, added };
}

const fetchEvent = (request: { mode: string }) => {
  let responded: Promise<unknown> | undefined;
  return { request, respondWith: (p: Promise<unknown>) => (responded = p), result: () => responded };
};

test("à l'installation, seule la page hors connexion et l'icône sont gardées", async () => {
  const { handlers, added } = loadWorker(async () => "réseau");
  let waited: Promise<unknown> | undefined;
  handlers.install({ waitUntil: (p: Promise<unknown>) => (waited = p) });
  await waited;
  assert.deepEqual(added, ["/offline.html", "/icons/icon-192.png"]);
});

test("sans réseau, l'ouverture d'une page affiche la page hors connexion", async () => {
  const { handlers } = loadWorker(async () => {
    throw new TypeError("Failed to fetch");
  });
  const event = fetchEvent({ mode: "navigate" });
  handlers.fetch(event);
  assert.equal(await event.result(), "PAGE_HORS_CONNEXION");
});

test("avec du réseau, la page vient du réseau (jamais d'une copie gardée)", async () => {
  const { handlers } = loadWorker(async () => "PAGE_DU_RESEAU");
  const event = fetchEvent({ mode: "navigate" });
  handlers.fetch(event);
  assert.equal(await event.result(), "PAGE_DU_RESEAU");
});

test("les données de l'appli (autres requêtes) ne sont jamais interceptées ni gardées", () => {
  const { handlers } = loadWorker(async () => "x");
  const event = fetchEvent({ mode: "cors" });
  handlers.fetch(event);
  assert.equal(event.result(), undefined);
});

/// Variante avec de quoi afficher des notifications et rouvrir l'appli.
function loadPushWorker(openWindows: Array<{ navigate: (u: string) => Promise<void>; focus: () => Promise<void> }> = []) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn),
    skipWaiting: () => {},
    registration: { showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }) },
    clients: { claim: async () => {}, matchAll: async () => openWindows, openWindow: async (u: string) => void opened.push(u) },
  };
  vm.runInNewContext(readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8"), { self, caches: {}, fetch: async () => "x" });
  return { handlers, shown, opened };
}

const pushEvent = (payload: unknown, raw = false) => {
  let waited: Promise<unknown> | undefined;
  return {
    data: { json: () => (raw ? JSON.parse(payload as string) : payload) },
    waitUntil: (p: Promise<unknown>) => (waited = p),
    done: () => waited,
  };
};

test("une notification reçue s'affiche avec son texte et mène vers la bonne page", async () => {
  const { handlers, shown } = loadPushWorker();
  const event = pushEvent({ title: "Sara : Réunion lundi", body: "15h en salle", url: "/messages", tag: "announcement" });
  handlers.push(event);
  await event.done();
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Sara : Réunion lundi");
  assert.equal(shown[0].options.body, "15h en salle");
  assert.equal(shown[0].options.tag, "announcement");
  assert.equal(JSON.stringify(shown[0].options.data), JSON.stringify({ url: "/messages" }));
});

test("une notification illisible ou au lien externe reste inoffensive", async () => {
  const { handlers, shown } = loadPushWorker();
  const broken = pushEvent("pas du json", true);
  handlers.push(broken);
  await broken.done();
  assert.equal(shown[0].title, "MYRESTO");
  assert.equal(JSON.stringify(shown[0].options.data), JSON.stringify({ url: "/aujourdhui" }));

  const external = pushEvent({ title: "x", url: "https://evil.example" });
  handlers.push(external);
  await external.done();
  assert.equal(JSON.stringify(shown[1].options.data), JSON.stringify({ url: "/aujourdhui" }));
});

test("appuyer sur la notification ramène l'appli ouverte vers la bonne page, sinon l'ouvre", async () => {
  let navigatedTo = "";
  let focused = false;
  const open = { navigate: async (u: string) => void (navigatedTo = u), focus: async () => void (focused = true) };
  const withWindow = loadPushWorker([open]);
  let closed = false;
  let waited: Promise<unknown> | undefined;
  withWindow.handlers.notificationclick({ notification: { close: () => (closed = true), data: { url: "/messages" } }, waitUntil: (p: Promise<unknown>) => (waited = p) });
  await waited;
  assert.ok(closed);
  assert.equal(navigatedTo, "/messages");
  assert.ok(focused);

  const none = loadPushWorker([]);
  none.handlers.notificationclick({ notification: { close: () => {}, data: { url: "/planning" } }, waitUntil: (p: Promise<unknown>) => (waited = p) });
  await waited;
  assert.equal(JSON.stringify(none.opened), JSON.stringify(["/planning"]));
});
