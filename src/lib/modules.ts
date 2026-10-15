/// Les fonctionnalités qu'un établissement peut afficher ou masquer pour ne pas être encombré de ce
/// dont il n'a pas besoin. Masquer retire l'entrée du menu et l'accès à la page ; rien n'est supprimé,
/// tout revient en réactivant. "Aujourd'hui", "Mon espace" et "Paramètres" restent toujours là.
export const MODULES = [
  { key: "planning", label: "Planning", description: "Les horaires de l'équipe, la semaine type et les remplacements.", href: "/planning" },
  { key: "reservations", label: "Réservations", description: "Les réservations du jour, des jours à venir et les demandes en ligne.", href: "/reservations" },
  { key: "floorplan", label: "Plan de salle", description: "Le plan des tables, par jour et par service, et le plan du service sur Aujourd'hui.", href: "/plan-de-salle" },
  { key: "staff", label: "Équipe", description: "Les fiches du personnel et leurs accès.", href: "/equipe" },
  { key: "timeoff", label: "Congés", description: "Les demandes de congé et d'absence à valider.", href: "/conges" },
  { key: "crm", label: "Clients", description: "Les fiches clients et la newsletter.", href: "/clients" },
  { key: "finance", label: "Finances", description: "Le chiffre d'affaires, les couverts et les graphiques.", href: "/finances" },
  { key: "inventory", label: "Stock", description: "Les listes de courses par fournisseur.", href: "/stock" },
  { key: "marketing", label: "Communication", description: "Le calendrier des publications.", href: "/marketing" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

const VALID = new Set<string>(MODULES.map((m) => m.key));

export function parseDisabledModules(csv: string | null | undefined): Set<ModuleKey> {
  return new Set(
    (csv ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter((k): k is ModuleKey => VALID.has(k))
  );
}

/// Toujours dans l'ordre du catalogue, sans doublon ni clé inconnue.
export function serializeDisabledModules(keys: Iterable<string>): string {
  const set = new Set(keys);
  return MODULES.filter((m) => set.has(m.key))
    .map((m) => m.key)
    .join(",");
}

export function isModuleEnabled(csv: string | null | undefined, key: ModuleKey): boolean {
  return !parseDisabledModules(csv).has(key);
}

/// La fonctionnalité à laquelle appartient une adresse du menu (null pour les pages toujours visibles).
export function moduleKeyForHref(href: string): ModuleKey | null {
  return MODULES.find((m) => href === m.href || href.startsWith(m.href + "/"))?.key ?? null;
}
