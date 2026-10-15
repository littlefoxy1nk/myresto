import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVATAR_EYE_COLORS,
  AVATAR_HAIR_COLORS,
  AVATAR_SKINS,
  colorOf,
  defaultAvatar,
  isAvatarConfig,
  parseAvatar,
  randomAvatar,
  shade,
} from "./avatar";

const owner = { gender: "woman", skin: "fair", hair: "red", hairStyle: "bun", eyes: "blue" };

test("un avatar complet et valide est repris tel quel", () => {
  assert.deepEqual(parseAvatar(JSON.stringify(owner), "u1"), owner);
});

test("rien, JSON cassé ou option inconnue → avatar par défaut valide", () => {
  for (const bad of [null, undefined, "", "pas du json", JSON.stringify({ ...owner, hair: "vert" }), JSON.stringify({ gender: "woman" })]) {
    assert.ok(isAvatarConfig(parseAvatar(bad, "u1")));
  }
});

test("l'avatar par défaut est stable pour une même personne et varie d'une personne à l'autre", () => {
  assert.deepEqual(defaultAvatar("abc"), defaultAvatar("abc"));
  const variety = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(defaultAvatar(`user-${i}`))));
  assert.ok(variety.size > 10);
  assert.ok(Array.from({ length: 40 }, (_, i) => defaultAvatar(`user-${i}`)).every((a) => a.hairStyle !== "bald"));
});

test("randomAvatar tire toujours des options valides", () => {
  for (let i = 0; i < 50; i++) assert.ok(isAvatarConfig(randomAvatar()));
  assert.ok(isAvatarConfig(randomAvatar(() => 0.999999)));
  assert.ok(isAvatarConfig(randomAvatar(() => 0)));
});

test("couleurs : hexadécimal valide, clé inconnue → première couleur", () => {
  for (const list of [AVATAR_SKINS, AVATAR_HAIR_COLORS, AVATAR_EYE_COLORS]) {
    for (const o of list) assert.match(o.color, /^#[0-9a-f]{6}$/);
  }
  assert.equal(colorOf(AVATAR_HAIR_COLORS, "red"), "#b4491f");
  assert.equal(colorOf(AVATAR_HAIR_COLORS, "inconnu"), AVATAR_HAIR_COLORS[0].color);
});

test("shade assombrit sans sortir des bornes", () => {
  assert.equal(shade("#ffffff", 0.5), "#808080");
  assert.equal(shade("#000000", 0.5), "#000000");
  assert.match(shade("#f4cdb0", 0.1), /^#[0-9a-f]{6}$/);
});
