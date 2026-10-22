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
