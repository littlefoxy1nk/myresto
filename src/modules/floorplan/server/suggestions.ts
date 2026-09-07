import type { TableWithLiveState } from "@/modules/floorplan/types";

export type TableSuggestion = {
  kind: "table" | "group";
  tableIds: string[];
  label: string;
  capacity: number;
  /// Écart entre la capacité proposée et la taille demandée — plus c'est petit, mieux
  /// c'est (évite de bloquer une table de 8 pour 2 personnes).
  overflow: number;
};

/// La recommandation de table décrite dans la vision produit ("T8 est recommandé" /
/// "T4 + T5 permettent d'accueillir cette réservation") — utilisée par le flux de création
/// de réservation via reservations/server/planning.ts. Fonction pure : ne sait rien de
/// "maintenant" ni d'un créneau, elle raisonne uniquement sur l'état déjà calculé
/// (liveState) qu'on lui fournit. Regroupe les membres d'un même groupe en une seule
/// proposition combinée plutôt que de les proposer séparément.
export function suggestTablesForParty(tables: TableWithLiveState[], partySize: number): TableSuggestion[] {
  const available = tables.filter((t) => t.liveState === "available");
  const suggestions: TableSuggestion[] = [];
  const consideredGroupIds = new Set<string>();

  for (const t of available) {
    if (t.group) {
      if (consideredGroupIds.has(t.group.id)) continue;
      consideredGroupIds.add(t.group.id);
      if (t.group.combinedCapacity >= partySize) {
        const memberLabels = t.group.tableIds
          .map((id) => tables.find((x) => x.id === id)?.label)
          .filter(Boolean)
          .join(" + ");
        suggestions.push({
          kind: "group",
          tableIds: t.group.tableIds,
          label: memberLabels || t.label,
          capacity: t.group.combinedCapacity,
          overflow: t.group.combinedCapacity - partySize,
        });
      }
      continue;
    }
    if (t.capacity >= partySize) {
      suggestions.push({
        kind: "table",
        tableIds: [t.id],
        label: t.label,
        capacity: t.capacity,
        overflow: t.capacity - partySize,
      });
    }
  }

  return suggestions.sort((a, b) => a.overflow - b.overflow);
}
