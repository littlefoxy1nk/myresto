import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { buildPaperSheets, serviceIndexFor, sortTableLabels, type PaperService } from "./paper-plan";
import { buildPaperPlanPdf, paginateRows, paperDateLabel, paperTitle } from "./paper-plan-pdf";

const SERVICES: PaperService[] = [
  { id: "a", name: "1er service", startTime: "18:00", endTime: "20:00" },
  { id: "b", name: "2e service", startTime: "20:00", endTime: "22:30" },
];
const ZONES = [
  { id: "z2", name: "Terrasse", sortOrder: 2, tables: [{ id: "t20", label: "T1" }] },
  { id: "z1", name: "Salle intérieur", sortOrder: 1, tables: [{ id: "t10", label: "10" }, { id: "t2", label: "2" }, { id: "t1", label: "1" }] },
  { id: "z3", name: "Vide", sortOrder: 3, tables: [] },
];

test("les tables sont rangées dans l'ordre naturel", () => {
  assert.deepEqual(sortTableLabels([{ label: "10" }, { label: "2" }, { label: "1" }, { label: "T3" }]).map((t) => t.label), ["1", "2", "10", "T3"]);
});

test("une arrivée va dans son service, en avance dans le suivant, tardive dans le dernier", () => {
  assert.equal(serviceIndexFor("18:30", SERVICES), 0);
  assert.equal(serviceIndexFor("20:00", SERVICES), 1);
  assert.equal(serviceIndexFor("17:00", SERVICES), 0);
  assert.equal(serviceIndexFor("23:30", SERVICES), 1);
  assert.equal(serviceIndexFor("12:00", []), 0);
});

test("une feuille par salle non vide, dans l'ordre des salles, une colonne par service", () => {
  const sheets = buildPaperSheets({ dateKey: "2026-11-15", zones: ZONES, services: SERVICES, reservations: [], includeUnassigned: true });
  assert.deepEqual(sheets.map((s) => s.zoneName), ["Salle intérieur", "Terrasse"]);
  assert.deepEqual(sheets[0].rows.map((r) => r.label), ["1", "2", "10"]);
  assert.equal(sheets[0].sections.length, 2);
  assert.equal(sheets[0].sections[0].subtitle, "18:00 – 20:00");
  assert.ok(sheets[0].rows.every((r) => r.entries.length === 2 && r.entries.every((e) => e.length === 0)));
});

test("les réservations vont sur leur table, dans leur colonne, triées par heure", () => {
  const sheets = buildPaperSheets({
    dateKey: "2026-11-15",
    zones: ZONES,
    services: SERVICES,
    reservations: [
      { customerName: "Dupont", partySize: 4, time: "18:30", tableIds: ["t1"] },
      { customerName: "Martin", partySize: 2, time: "20:30", tableIds: ["t1"] },
      { customerName: "Tôt", partySize: 2, time: "18:00", tableIds: ["t1"] },
      { customerName: "Grande tablée", partySize: 8, time: "19:00", tableIds: ["t1", "t2"] },
    ],
    includeUnassigned: true,
  });
  const row1 = sheets[0].rows[0];
  assert.deepEqual(row1.entries[0].map((e) => e.name), ["Tôt", "Dupont", "Grande tablée"]);
  assert.deepEqual(row1.entries[1].map((e) => e.name), ["Martin"]);
  assert.deepEqual(sheets[0].rows[1].entries[0].map((e) => e.name), ["Grande tablée"]);
});

test("le numéro de GSM suit la réservation sur la feuille (espaces retirés en bord, absent = vide)", () => {
  const sheets = buildPaperSheets({
    dateKey: "2026-11-15",
    zones: ZONES,
    services: SERVICES,
    reservations: [
      { customerName: "Dupont", customerPhone: " 0475 12 34 56 ", partySize: 4, time: "18:30", tableIds: ["t1"] },
      { customerName: "Martin", customerPhone: null, partySize: 2, time: "20:30", tableIds: ["t1"] },
    ],
    includeUnassigned: true,
  });
  assert.equal(sheets[0].rows[0].entries[0][0].phone, "0475 12 34 56");
  assert.equal(sheets[0].rows[0].entries[1][0].phone, "");
});

test("sans service ce jour-là : une seule colonne « Journée »", () => {
  const sheets = buildPaperSheets({
    dateKey: "2026-11-15",
    zones: ZONES,
    services: [],
    reservations: [{ customerName: "Dupont", partySize: 4, time: "12:30", tableIds: ["t1"] }],
    includeUnassigned: true,
  });
  assert.deepEqual(sheets[0].sections, [{ title: "Journée", subtitle: null }]);
  assert.equal(sheets[0].rows[0].entries[0][0].name, "Dupont");
});

test("les réservations sans table finissent sur la dernière feuille, seulement si demandé", () => {
  const input = {
    dateKey: "2026-11-15",
    zones: ZONES,
    services: SERVICES,
    reservations: [{ customerName: "Sans table", partySize: 3, time: "19:00", tableIds: [] }],
  };
  const withIt = buildPaperSheets({ ...input, includeUnassigned: true });
  assert.equal(withIt[0].rows.length, 3);
  const last = withIt[withIt.length - 1].rows.at(-1)!;
  assert.equal(last.label, "Sans table");
  assert.equal(last.entries[0][0].name, "Sans table");
  const without = buildPaperSheets({ ...input, includeUnassigned: false });
  assert.ok(without.every((s) => s.rows.every((r) => r.label !== "Sans table")));
});

test("le titre et la date sont lisibles", () => {
  assert.equal(paperTitle("Salle intérieur"), "Plan salle intérieur");
  assert.match(paperDateLabel("2026-11-15"), /dimanche 15 novembre 2026/);
});

test("peu de tables : une page, lignes de 30 max ; beaucoup : plusieurs pages, lignes de 15 min", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ label: String(i + 1), entries: [[]] }));
  const few = paginateRows(rows(5), 400);
  assert.equal(few.pages.length, 1);
  assert.equal(few.rowHeight, 30);
  const many = paginateRows(rows(60), 400);
  assert.ok(many.pages.length > 1);
  assert.equal(many.rowHeight, 15);
  assert.equal(many.pages.flat().length, 60);
  // plusieurs réservations sur une table : la ligne grandit
  const tall = paginateRows([{ label: "1", entries: [[{ time: "18:00", partySize: 2, name: "A", phone: "" }, { time: "19:00", partySize: 2, name: "B", phone: "" }]] }], 400);
  assert.equal(tall.pages.length, 1);
});

test("une table avec trop de réservations pour une page est coupée en morceaux, aucune n'est perdue", () => {
  const entries = Array.from({ length: 60 }, (_, i) => ({ time: "19:00", partySize: 2, name: `R${i}`, phone: "" }));
  const { rowHeight, pages } = paginateRows([{ label: "Sans table", entries: [entries] }], 400);
  assert.ok(pages.length > 1);
  const perPage = Math.floor(400 / rowHeight);
  for (const page of pages) assert.ok(page.reduce((n, r) => n + Math.max(1, ...r.entries.map((e) => e.length)), 0) <= perPage);
  assert.equal(pages.flat().reduce((n, r) => n + r.entries[0].length, 0), 60);
});

test("le PDF est un vrai PDF : une page par salle et par jour", async () => {
  const sheets = [
    ...buildPaperSheets({
      dateKey: "2026-11-15",
      zones: ZONES,
      services: SERVICES,
      reservations: [{ customerName: "Très très long nom de famille composé ✓ 日本", partySize: 4, time: "18:30", tableIds: ["t1"] }],
      includeUnassigned: true,
    }),
    ...buildPaperSheets({ dateKey: "2026-11-16", zones: ZONES, services: [], reservations: [], includeUnassigned: true }),
  ];
  const bytes = await buildPaperPlanPdf({ establishmentName: "Le Petit Comptoir", sheets });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 4);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(width > height, "A4 en paysage");
});

test("plus de trois services : la feuille continue sur une page de plus", async () => {
  const four = Array.from({ length: 4 }, (_, i) => ({ id: String(i), name: `S${i}`, startTime: `${10 + i * 3}:00`, endTime: `${12 + i * 3}:00` }));
  const sheets = buildPaperSheets({ dateKey: "2026-11-15", zones: [ZONES[1]], services: four, reservations: [], includeUnassigned: false });
  const doc = await PDFDocument.load(await buildPaperPlanPdf({ establishmentName: "X", sheets }));
  assert.equal(doc.getPageCount(), 2);
});
