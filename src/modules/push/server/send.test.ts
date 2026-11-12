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

import { explainPushFailure, vapidKeyProblem } from "./send";

const GOOD_PUB = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
const GOOD_PRIV = Buffer.alloc(32, 9).toString("base64url");

test("des clés bien formées sont acceptées, des clés abîmées sont expliquées", () => {
  assert.equal(vapidKeyProblem({ publicKey: GOOD_PUB, privateKey: GOOD_PRIV, subject: "mailto:a@b.c" }), null);
  assert.match(vapidKeyProblem({ publicKey: GOOD_PUB.slice(0, 40), privateKey: GOOD_PRIV, subject: "x" }) ?? "", /publique/);
  assert.match(vapidKeyProblem({ publicKey: GOOD_PUB, privateKey: GOOD_PRIV + "abc", subject: "x" }) ?? "", /privée/);
  assert.match(vapidKeyProblem({ publicKey: GOOD_PUB + " x", privateKey: GOOD_PRIV, subject: "x" }) ?? "", /publique/);
});

test("les clés recopiées avec des guillemets sont tolérées", () => {
  assert.equal(vapidConfig({ VAPID_PUBLIC_KEY: `"${GOOD_PUB}"`, VAPID_PRIVATE_KEY: `'${GOOD_PRIV}'\n` })?.publicKey, GOOD_PUB);
});

test("l'échec d'un essai dit quoi faire", () => {
  assert.match(explainPushFailure({ devices: 0, sent: 0, failures: [] }), /Aucun appareil/);
  assert.match(explainPushFailure({ devices: 1, sent: 0, failures: [{ status: 403, reason: "" }] }), /clés/);
  assert.match(explainPushFailure({ devices: 1, sent: 0, failures: [{ status: 503, reason: "" }] }), /indisponible/);
  assert.match(explainPushFailure({ devices: 1, sent: 0, failures: [{ reason: "timeout" }] }), /joindre/);
  assert.equal(explainPushFailure({ devices: 0, sent: 0, failures: [], problem: "Clés mal recopiées" }), "Clés mal recopiées");
});
