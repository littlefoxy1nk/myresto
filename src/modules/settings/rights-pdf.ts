import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PERMISSIONS } from "@/lib/permissions";

export type RightsRole = { label: string; permissions: Set<string> };

const CATEGORY_LABELS: Record<string, string> = {
  reservations: "Réservations et salle",
  staff: "Équipe et planning",
  finance: "Finances",
  inventory: "Stock",
  crm: "Clients",
  marketing: "Communication",
  settings: "Paramètres",
};

/// Une phrase simple par droit : ce que la personne peut réellement faire.
export const PERMISSION_EXPLANATIONS: Record<string, string> = {
  "reservations.view": "Consulter la liste des réservations.",
  "reservations.edit": "Créer, modifier, confirmer, annuler et déplacer des réservations ; traiter les demandes faites en ligne.",
  "floorplan.view": "Voir le plan de salle (tables libres, occupées, réservées), jour par jour.",
  "floorplan.edit": "Modifier le plan : ajouter, déplacer, fusionner ou supprimer des tables.",
  "service.run": "Utiliser l'écran du service : installer des clients, libérer des tables, noter les arrivées.",
  "staff.view": "Voir la liste de l'équipe.",
  "staff.manage": "Créer et modifier les fiches du personnel, leur rôle et leurs accès.",
  "schedule.view": "Voir le planning.",
  "schedule.edit": "Construire et modifier le planning, publier les horaires, demander des renforts.",
  "timeoff.manage": "Valider ou refuser les demandes de congé et d'absence.",
  "finance.view": "Voir le chiffre d'affaires, les couverts et les graphiques.",
  "finance.manage": "Saisir les chiffres (clôture du jour, total du mois).",
  "inventory.view": "Voir les listes de courses.",
  "inventory.manage": "Créer et modifier les listes de courses.",
  "crm.view": "Voir les fiches clients.",
  "crm.manage": "Modifier les fiches clients et écrire aux abonnés à la newsletter.",
  "marketing.view": "Voir le calendrier des publications.",
  "marketing.publish": "Préparer, planifier et marquer comme publiées les publications.",
  "settings.manage": "Régler l'établissement : services, fonctionnalités, droits d'accès, réservation en ligne.",
};

/// Les polices standard du PDF ne connaissent que les caractères « Windows » : on remplace le reste
/// plutôt que de faire échouer tout le document sur un caractère exotique (nom de rôle personnalisé).
export function toWinAnsi(text: string): string {
  return text
    .replace(/[  ]/g, " ")
    .replace(/→/g, "->")
    .replace(/[^\n\x20-\x7e¡-ÿŒœ‘’“”–—…€]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of toWinAnsi(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;
const INK = rgb(0.11, 0.1, 0.09);
const MUTED = rgb(0.47, 0.44, 0.42);
const ACCENT = rgb(0.71, 0.4, 0.11);
const BAND = rgb(0.96, 0.93, 0.89);

/// Le PDF des droits d'accès : une explication simple, le tableau rôles × droits, puis ce que permet chaque droit.
export async function buildRightsPdf(params: { establishmentName: string; roles: RightsRole[]; date: Date }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Droits d'accès - ${params.establishmentName}`);
  doc.setProducer("MYRESTO");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const dateLabel = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(params.date);
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (t: string, x: number, yy: number, size: number, f = font, color = INK) =>
    page.drawText(toWinAnsi(t), { x, y: yy, size, font: f, color });

  // En-tête et explication
  text(`Droits d'accès — ${params.establishmentName}`, MARGIN, y - 18, 20, bold);
  text(`Document du ${dateLabel}`, MARGIN, y - 36, 9, font, MUTED);
  y -= 58;
  const intro = [
    "Chaque personne de l'équipe a un rôle (son poste dans l'établissement). Le rôle décide de ce qu'elle voit et de ce qu'elle peut faire dans MYRESTO.",
    "Dans le tableau, une coche signifie que le rôle a ce droit. Un droit « voir » permet de consulter ; un droit « gérer » ou « modifier » permet aussi de changer les données.",
    "Les droits d'un rôle se règlent dans Paramètres, onglet Droits d'accès. Les pages des fonctionnalités masquées dans Paramètres, onglet Fonctionnalités, ne sont proposées à personne.",
  ];
  for (const paragraph of intro) {
    for (const line of wrap(paragraph, font, 10, PAGE_W - 2 * MARGIN)) {
      text(line, MARGIN, y, 10);
      y -= 14;
    }
    y -= 4;
  }
  y -= 8;

  // Tableau
  const roleCount = Math.max(1, params.roles.length);
  const labelW = 215;
  const colW = (PAGE_W - 2 * MARGIN - labelW) / roleCount;
  const rowH = 17;

  const drawHeader = () => {
    const lines = params.roles.map((r) => wrap(r.label, bold, 7.5, colW - 6).slice(0, 3));
    const height = Math.max(...lines.map((l) => l.length), 1) * 9 + 8;
    page.drawRectangle({ x: MARGIN, y: y - height, width: PAGE_W - 2 * MARGIN, height, color: BAND });
    text("Droit", MARGIN + 6, y - height / 2 - 3, 9, bold);
    lines.forEach((ls, i) => {
      ls.forEach((l, j) => {
        const w = bold.widthOfTextAtSize(l, 7.5);
        text(l, MARGIN + labelW + colW * i + (colW - w) / 2, y - 12 - j * 9, 7.5, bold);
      });
    });
    y -= height + 2;
  };

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  drawHeader();
  const categories = [...new Set(PERMISSIONS.map((p) => p.category))];
  for (const category of categories) {
    const perms = PERMISSIONS.filter((p) => p.category === category);
    if (y - rowH * (perms.length + 1) < MARGIN + 10) {
      newPage();
      drawHeader();
    }
    text((CATEGORY_LABELS[category] ?? category).toUpperCase(), MARGIN + 6, y - 11, 7.5, bold, MUTED);
    y -= rowH;
    for (const perm of perms) {
      text(perm.label, MARGIN + 6, y - 11, 8.5);
      params.roles.forEach((role, i) => {
        if (!role.permissions.has(perm.key)) return;
        const cx = MARGIN + labelW + colW * i + colW / 2;
        const cy = y - 8;
        page.drawLine({ start: { x: cx - 3.5, y: cy }, end: { x: cx - 1, y: cy - 3 }, thickness: 1.6, color: ACCENT });
        page.drawLine({ start: { x: cx - 1, y: cy - 3 }, end: { x: cx + 4, y: cy + 4 }, thickness: 1.6, color: ACCENT });
      });
      page.drawLine({ start: { x: MARGIN, y: y - rowH + 3 }, end: { x: PAGE_W - MARGIN, y: y - rowH + 3 }, thickness: 0.4, color: BAND });
      y -= rowH;
    }
  }

  // Ce que permet chaque droit
  newPage();
  text("Ce que permet chaque droit", MARGIN, y - 16, 15, bold);
  y -= 40;
  for (const category of categories) {
    if (y < MARGIN + 60) newPage();
    text(CATEGORY_LABELS[category] ?? category, MARGIN, y, 11, bold, ACCENT);
    y -= 16;
    for (const perm of PERMISSIONS.filter((p) => p.category === category)) {
      const lines = wrap(PERMISSION_EXPLANATIONS[perm.key] ?? perm.label, font, 9.5, PAGE_W - 2 * MARGIN - 190);
      if (y - lines.length * 12 < MARGIN) {
        newPage();
        y -= 4;
      }
      text(perm.label, MARGIN + 6, y, 9.5, bold);
      lines.forEach((l, i) => text(l, MARGIN + 190, y - i * 12, 9.5));
      y -= Math.max(lines.length, 1) * 12 + 5;
    }
    y -= 8;
  }

  return doc.save();
}
