/// Recherche de la palette de commandes (⌘K) : sans accents ni majuscules, tous les mots
/// saisis doivent se retrouver dans le libellé ou les mots-clés. Pas de classement « malin » :
/// les résultats gardent l'ordre du menu, ceux dont le libellé commence par la saisie passent devant.
export type PaletteEntry = { href: string; label: string; icon: string; hint?: string; keywords?: string };

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .trim();
}

export function searchPalette(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  const scored: { entry: PaletteEntry; starts: boolean; index: number }[] = [];
  entries.forEach((entry, index) => {
    const label = normalize(entry.label);
    const haystack = `${label} ${normalize(entry.keywords ?? "")}`;
    if (words.every((w) => haystack.includes(w))) scored.push({ entry, starts: label.startsWith(words[0]), index });
  });
  scored.sort((a, b) => Number(b.starts) - Number(a.starts) || a.index - b.index);
  return scored.map((s) => s.entry);
}
