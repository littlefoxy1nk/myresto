import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

/// Garde-fou explicite de la phase de consolidation : MYRESTO ne calcule jamais un
/// nombre de personnel recommandé à partir des couverts/réservations (ex. l'ancienne
/// règle "~1 serveur pour 20 couverts", supprimée de today-intelligence.ts). Ce test
/// scanne le code source réel plutôt que de ne tester qu'une fonction, car le principe
/// à garantir porte sur l'absence d'un CONCEPT dans tout le produit, pas sur une seule
/// fonction qui pourrait être contournée ailleurs.
const SRC_ROOT = join(__dirname, "..", "..");

const EXCLUDED_DIRS = new Set(["generated", "node_modules"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.has(extname(entry)) && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

const BANNED_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /coversPerStaff/, label: "coversPerStaff" },
  { pattern: /recommendedFloorStaff/, label: "recommendedFloorStaff" },
  { pattern: /floorStaffCount/, label: "floorStaffCount" },
  { pattern: /computeDemandLevel/, label: "computeDemandLevel" },
  { pattern: /\bDemandLevel\b/, label: "DemandLevel" },
  { pattern: /understaffed-floor/, label: "understaffed-floor" },
  { pattern: /add-floor-staff/, label: "add-floor-staff" },
  { pattern: /serveurs?\s+pour\s+\d+\s+couverts?/i, label: '"serveur(s) pour N couvert(s)"' },
  { pattern: /\d+\s+couverts?\s+pour\s+\d*\s*serveurs?/i, label: '"N couvert(s) pour serveur(s)"' },
  { pattern: /\bcovers\s*\/\s*\d+/, label: "covers / <number>" },
  { pattern: /\bpartySize\s*\/\s*\d+/, label: "partySize / <number>" },
];

test("no covers/ratio-style computation determines a recommended staff count anywhere in the codebase", () => {
  const files = collectSourceFiles(SRC_ROOT);
  assert.ok(files.length > 50, "sanity check: the source scan should find a substantial number of files");

  const violations: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    for (const { pattern, label } of BANNED_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${file}: matched banned pattern ${label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
