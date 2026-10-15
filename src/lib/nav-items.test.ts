import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, splitMobileNav, visibleNavItems } from "./nav-items";

test("le planning est juste au-dessus de l'équipe dans le menu", () => {
  const hrefs = NAV_ITEMS.map((i) => i.href);
  assert.equal(hrefs.indexOf("/planning") + 1, hrefs.indexOf("/equipe"));
});

test("Paramètres reste le dernier item", () => {
  assert.equal(NAV_ITEMS[NAV_ITEMS.length - 1].href, "/parametres");
});

test("mobile : quatre onglets épinglés, le reste dans « Plus »", () => {
  const all = visibleNavItems(() => true);
  const { pinned, more } = splitMobileNav(all);
  assert.equal(pinned.length, 4);
  assert.deepEqual(
    pinned.map((i) => i.href),
    ["/aujourdhui", "/reservations", "/plan-de-salle", "/planning"],
  );
  assert.equal(pinned.length + more.length, all.length);
  assert.ok(more.some((i) => i.href === "/parametres"));
});

test("mobile : un rôle restreint garde une barre remplie et rien n'est perdu", () => {
  const limited = visibleNavItems((p) => p === "schedule.view");
  const { pinned, more } = splitMobileNav(limited);
  assert.deepEqual(
    pinned.map((i) => i.href),
    ["/aujourdhui", "/mon-espace", "/planning"],
  );
  assert.deepEqual(more.map((i) => i.href), ["/parametres"]);
});
