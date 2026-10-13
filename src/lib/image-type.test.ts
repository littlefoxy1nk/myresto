import { test } from "node:test";
import assert from "node:assert/strict";
import { detectImageType } from "./image-type";

test("JPEG, PNG et WebP reconnus par leurs octets", () => {
  assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.mime, "image/jpeg");
  assert.equal(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime, "image/png");
  const webp = Uint8Array.from([..."RIFF"].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [..."WEBP"].map((c) => c.charCodeAt(0))));
  assert.equal(detectImageType(webp)?.extension, ".webp");
});

test("tout le reste est refusé (PDF, texte, HTML, SVG, fichier vide)", () => {
  assert.equal(detectImageType(new TextEncoder().encode("%PDF-1.4")), null);
  assert.equal(detectImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  assert.equal(detectImageType(new TextEncoder().encode("<html><script>alert(1)</script>")), null);
  assert.equal(detectImageType(new Uint8Array()), null);
});
