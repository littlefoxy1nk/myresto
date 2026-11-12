import { test } from "node:test";
import assert from "node:assert/strict";
import { isGoneStatus, vapidConfig } from "./send";

test("sans clés, les notifications téléphone sont désactivées", () => {
  assert.equal(vapidConfig({}), null);
  assert.equal(vapidConfig({ VAPID_PUBLIC_KEY: "abc" }), null);
  assert.equal(vapidConfig({ VAPID_PRIVATE_KEY: "abc" }), null);
});

test("avec les deux clés, le contact vient d'APP_URL (https) ou d'une adresse par défaut", () => {
  assert.deepEqual(vapidConfig({ VAPID_PUBLIC_KEY: " pub ", VAPID_PRIVATE_KEY: "priv", APP_URL: "https://myresto-seven.vercel.app" }), {
    publicKey: "pub",
    privateKey: "priv",
    subject: "https://myresto-seven.vercel.app",
  });
  assert.equal(vapidConfig({ VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k", APP_URL: "http://localhost:3000" })?.subject, "mailto:contact@myresto.app");
  assert.equal(vapidConfig({ VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k", VAPID_SUBJECT: "mailto:chloe@example.com" })?.subject, "mailto:chloe@example.com");
});

test("seuls 404 et 410 signalent un appareil disparu", () => {
  assert.ok(isGoneStatus(404));
  assert.ok(isGoneStatus(410));
  for (const s of [undefined, 200, 400, 401, 413, 429, 500, 503]) assert.equal(isGoneStatus(s), false);
});
