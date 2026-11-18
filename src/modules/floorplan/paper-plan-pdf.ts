import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { toWinAnsi } from "@/modules/settings/rights-pdf";
import type { PaperRow, PaperSheet } from "@/modules/floorplan/paper-plan";

const PAGE_W = 842; // A4 paysage
const PAGE_H = 595;
const MARGIN = 28;
const GAP = 24;
const MAX_PER_PAGE = 3; // colonnes (services) côte à côte
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.4, 0.4, 0.4);
const LINE = rgb(0.5, 0.55, 0.88);
const HEAD = rgb(0.82, 0.82, 0.82);
const MIN_ROW = 15;
const MAX_ROW = 30;

/// « samedi 15 novembre 2026 », à partir d'une clé yyyy-MM-dd.
export function paperDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${dateKey}T12:00:00`)
  );
}

/// « Plan salle intérieur » : le nom de la salle, en minuscules après « Plan ».
export function paperTitle(zoneName: string): string {
  return `Plan ${zoneName.trim().toLowerCase()}`;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = toWinAnsi(text).replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let out = clean;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

const linesOf = (row: PaperRow) => Math.max(1, ...row.entries.map((e) => e.length));

/// Coupe les lignes en pages : on garde des lignes lisibles (15 à 30 pt), et on passe à la page suivante quand ça ne tient plus.
/// Une table qui aurait plus de réservations qu'une page ne peut en porter (ex. « Sans table ») est coupée en morceaux.
export function paginateRows(rows: PaperRow[], availableHeight: number): { rowHeight: number; pages: PaperRow[][] } {
  const totalLines = rows.reduce((n, r) => n + linesOf(r), 0);
  const rowHeight = Math.min(MAX_ROW, Math.max(MIN_ROW, availableHeight / Math.max(totalLines, 1)));
  const maxLines = Math.max(1, Math.floor(availableHeight / rowHeight));

  const pieces: PaperRow[] = [];
  for (const row of rows) {
    const lines = linesOf(row);
    for (let start = 0; start < lines; start += maxLines) {
      pieces.push(lines <= maxLines ? row : { label: row.label, entries: row.entries.map((e) => e.slice(start, start + maxLines)) });
    }
  }

  const pages: PaperRow[][] = [[]];
  let used = 0;
  for (const row of pieces) {
    const h = linesOf(row) * rowHeight;
    if (used + h > availableHeight && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(row);
    used += h;
  }
  return { rowHeight, pages };
}

/// Le PDF du plan papier : une page A4 paysage par salle et par jour (plus d'une si la salle a beaucoup de tables
/// ou plus de trois services), avec les colonnes table / heure / nb pers / nom / GSM, à compléter au stylo.
export async function buildPaperPlanPdf(params: { establishmentName: string; sheets: PaperSheet[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Plan de salle - ${params.establishmentName}`);
  doc.setProducer("MYRESTO");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const sheet of params.sheets) {
    // Au-delà de trois services, on continue sur une autre page : les colonnes resteraient trop étroites pour écrire un nom.
    for (let from = 0; from < sheet.sections.length; from += MAX_PER_PAGE) {
      const indexes = sheet.sections.map((_, i) => i).slice(from, from + MAX_PER_PAGE);
      drawSheetPages(doc, font, bold, params.establishmentName, sheet, indexes, from > 0);
    }
  }
  return doc.save();
}

function drawSheetPages(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  establishmentName: string,
  sheet: PaperSheet,
  columns: number[],
  continued: boolean
) {
  const n = columns.length;
  const blockW = (PAGE_W - 2 * MARGIN - GAP * (n - 1)) / n;
  const small = n === 3;
  const size = small ? 9 : 10.5;
  const wTable = small ? 32 : 44;
  const wTime = small ? 36 : 46;
  const wParty = small ? 32 : 44;
  const wPhone = small ? 72 : 92;
  const wName = blockW - wTable - wTime - wParty - wPhone;
  const xName = wTable + wTime + wParty;
  const xPhone = xName + wName;
  const headH = 22;
  const titleBlockH = 98; // titre, date, noms des services
  const bodyTop = PAGE_H - MARGIN - titleBlockH - headH;
  const available = bodyTop - MARGIN - 8;

  const { rowHeight, pages } = paginateRows(sheet.rows, available);

  pages.forEach((rows, pageIndex) => {
    const page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
    const centered = (t: string, cx: number, y: number, s: number, f: PDFFont, color = INK) => {
      const clean = toWinAnsi(t);
      page.drawText(clean, { x: cx - f.widthOfTextAtSize(clean, s) / 2, y, size: s, font: f, color });
    };

    const suffix = pageIndex > 0 || continued ? " (suite)" : "";
    centered(`${paperTitle(sheet.zoneName)}${suffix}`, PAGE_W / 2, PAGE_H - MARGIN - 28, 26, bold);
    centered(`${paperDateLabel(sheet.dateKey)} — ${establishmentName}`, PAGE_W / 2, PAGE_H - MARGIN - 48, 10, font, MUTED);

    columns.forEach((sectionIndex, k) => {
      const x0 = MARGIN + k * (blockW + GAP);
      const section = sheet.sections[sectionIndex];
      const titleY = bodyTop + headH + 24;
      centered(section.title, x0 + blockW / 2, titleY, 15, bold);
      if (section.subtitle) centered(section.subtitle, x0 + blockW / 2, titleY - 13, 8.5, font, MUTED);

      // En-tête
      page.drawRectangle({ x: x0, y: bodyTop, width: blockW, height: headH, color: HEAD, borderColor: LINE, borderWidth: 1 });
      const heads: [string, number, number][] = [
        ["table", x0, wTable],
        ["heure", x0 + wTable, wTime],
        ["nb pers", x0 + wTable + wTime, wParty],
        ["Nom", x0 + xName, wName],
        ["GSM", x0 + xPhone, wPhone],
      ];
      for (const [label, hx, hw] of heads) {
        centered(label, hx + hw / 2, bodyTop + headH / 2 - 3, 9, bold);
        if (hx > x0) page.drawLine({ start: { x: hx, y: bodyTop }, end: { x: hx, y: bodyTop + headH }, thickness: 1, color: LINE });
      }

      // Lignes : une table = une ligne (plus si plusieurs réservations dans ce service)
      let top = bodyTop;
      for (const row of rows) {
        const lines = linesOf(row);
        const h = lines * rowHeight;
        const bottom = top - h;
        page.drawRectangle({ x: x0, y: bottom, width: blockW, height: h, borderColor: LINE, borderWidth: 1 });
        for (const vx of [x0 + wTable, x0 + wTable + wTime, x0 + xName, x0 + xPhone]) {
          page.drawLine({ start: { x: vx, y: bottom }, end: { x: vx, y: top }, thickness: 1, color: LINE });
        }
        // Un libellé long (« Sans table ») rétrécit pour tenir dans sa case plutôt que d'être coupé.
        let labelSize = size;
        const labelText = toWinAnsi(row.label);
        while (labelSize > 6.5 && font.widthOfTextAtSize(labelText, labelSize) > wTable - 6) labelSize -= 0.5;
        centered(fit(row.label, font, labelSize, wTable - 6), x0 + wTable / 2, bottom + h / 2 - labelSize * 0.35, labelSize, font);

        row.entries[sectionIndex].forEach((e, i) => {
          const lineTop = top - i * rowHeight;
          const baseline = lineTop - rowHeight / 2 - size * 0.35;
          if (i > 0) page.drawLine({ start: { x: x0 + wTable, y: lineTop }, end: { x: x0 + blockW, y: lineTop }, thickness: 0.5, color: LINE });
          centered(e.time, x0 + wTable + wTime / 2, baseline, size, bold);
          centered(String(e.partySize), x0 + wTable + wTime + wParty / 2, baseline, size, bold);
          page.drawText(fit(e.name, bold, size, wName - 8), { x: x0 + xName + 4, y: baseline, size, font: bold, color: INK });
          if (e.phone) centered(fit(e.phone, font, size - 1, wPhone - 4), x0 + xPhone + wPhone / 2, baseline, size - 1, font);
        });
        top = bottom;
      }
    });
  });
}
