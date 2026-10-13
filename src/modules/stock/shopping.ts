export const MAX_ITEM_LENGTH = 120;
export const MAX_ITEMS_PER_ADD = 60;

/// Ce que la personne tape ou colle → une liste d'articles : une ligne = un article. Les puces
/// ("- ", "• ", "* ") et les lignes vides sont ignorées, pour qu'on puisse coller une liste telle quelle.
export function parseItemLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*–]\s+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_ITEMS_PER_ADD)
    .map((line) => line.slice(0, MAX_ITEM_LENGTH));
}

/// Texte à copier/coller (WhatsApp, mail au fournisseur) : la rubrique puis ce qu'il reste à acheter.
export function listToText(name: string, items: { label: string; checked: boolean }[]): string {
  const remaining = items.filter((i) => !i.checked).map((i) => `- ${i.label}`);
  return [name, ...(remaining.length > 0 ? remaining : ["(rien à acheter)"])].join("\n");
}

/// Non cochés d'abord (ce qui reste à acheter), cochés ensuite — l'ordre de saisie est conservé dans chaque groupe.
export function sortItems<T extends { checked: boolean }>(items: T[]): T[] {
  return [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)];
}
