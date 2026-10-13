import { test } from "node:test";
import assert from "node:assert/strict";
import { charStatus, composePostText, parseHashtags } from "./compose";
import { channelStats, publishedPerMonth } from "./stats";

test("parseHashtags : # ajouté, @ gardé, doublons retirés", () => {
  assert.deepEqual(parseHashtags("resto, #Brunch @lepetitcomptoir  resto;brunch"), ["#resto", "#Brunch", "@lepetitcomptoir"]);
  assert.deepEqual(parseHashtags(""), []);
  assert.deepEqual(parseHashtags(null), []);
});

test("composePostText : blocs non vides séparés d'une ligne, hashtags à la fin", () => {
  assert.equal(
    composePostText({ hook: "Nouveau !", message: " Notre carte d'automne. ", cta: "", hashtags: ["#resto", "#carte"] }),
    "Nouveau !\n\nNotre carte d'automne.\n\n#resto #carte"
  );
  assert.equal(composePostText({ hook: "", message: "", cta: "", hashtags: [] }), "");
});

test("charStatus : limite connue pour Instagram et SMS, aucune pour Facebook", () => {
  assert.deepEqual(charStatus("a".repeat(161), "sms"), { count: 161, limit: 160, over: true });
  assert.equal(charStatus("a".repeat(2000), "instagram").over, false);
  assert.equal(charStatus("a".repeat(5000), "facebook").limit, null);
});

test("publishedPerMonth : 6 mois glissants, le courant inclus", () => {
  const out = publishedPerMonth(
    [{ date: "2026-10-02" }, { date: "2026-10-20" }, { date: "2026-08-15" }, { date: "2025-01-01" }],
    4,
    new Date(2026, 9, 13)
  );
  assert.deepEqual(out, [
    { key: "2026-07", count: 0 },
    { key: "2026-08", count: 1 },
    { key: "2026-09", count: 0 },
    { key: "2026-10", count: 2 },
  ]);
});

test("channelStats : totaux des résultats saisis, sans zéros inventés", () => {
  const out = channelStats([
    { channel: "instagram", date: "2026-10-01", likes: 40, comments: 3, reach: 900 },
    { channel: "instagram", date: "2026-10-05", likes: null, comments: null, reach: null },
    { channel: "facebook", date: "2026-10-06", likes: 10, comments: null, reach: null },
  ]);
  assert.deepEqual(out[0], { channel: "instagram", published: 2, likes: 40, comments: 3, reach: 900, withResults: 1 });
  assert.equal(out[1].withResults, 1);
});
