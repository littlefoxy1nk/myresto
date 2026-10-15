/// Chaque salle reçoit une largeur proportionnelle à celle de son plan : les tables ont ainsi la même taille d'une salle
/// à l'autre, au lieu de réduire la grande salle pour faire la place égale à la petite. Au-delà de trois salles, on passe
/// à la ligne (deux par ligne).
export function zoneColumns(zones: { tables: { posX: number; width: number }[] }[]): string {
  const widths = zones.map((z) =>
    z.tables.length === 0 ? 300 : Math.max(...z.tables.map((t) => t.posX + t.width)) - Math.min(...z.tables.map((t) => t.posX)) + 80
  );
  if (widths.length > 3) return "repeat(2, minmax(0, 1fr))";
  return widths.map((w) => `minmax(0, ${Math.round(w)}fr)`).join(" ");
}
