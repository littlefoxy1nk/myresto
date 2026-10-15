import type { PermissionKey } from "@/lib/permissions";

/// Les notifications regroupées en catégories compréhensibles, que chacun peut activer ou couper.
/// `requires` : la catégorie n'est proposée qu'à qui a ce droit (inutile de proposer « demandes de
/// congé à valider » à quelqu'un qui ne valide rien).
export const NOTIFICATION_CATEGORIES = [
  {
    key: "my_schedule",
    label: "Mes horaires",
    description: "Un service t'est attribué, modifié ou annulé.",
    types: ["shift_changed", "shift_cancelled"],
    requires: null,
  },
  {
    key: "my_leave",
    label: "Mes congés",
    description: "Ta demande de congé est acceptée ou refusée.",
    types: ["leave_approved", "leave_rejected"],
    requires: null,
  },
  {
    key: "replacements",
    label: "Remplacements",
    description: "Un collègue cherche quelqu'un pour le remplacer.",
    types: ["replacement_needed"],
    requires: null,
  },
  {
    key: "coverage_asked",
    label: "Renforts demandés",
    description: "On te demande si tu peux faire un service en plus.",
    types: ["coverage_requested"],
    requires: null,
  },
  {
    key: "coverage_answers",
    label: "Réponses aux renforts",
    description: "Quelqu'un accepte ou refuse le renfort que tu as demandé.",
    types: ["coverage_accepted", "coverage_declined"],
    requires: "schedule.edit",
  },
  {
    key: "availability",
    label: "Disponibilités de l'équipe",
    description: "Quelqu'un modifie ses disponibilités habituelles.",
    types: ["availability_changed"],
    requires: "schedule.edit",
  },
  {
    key: "leave_requests",
    label: "Congés à valider",
    description: "Une demande de congé ou d'absence attend ta décision.",
    types: ["leave_requested"],
    requires: "timeoff.manage",
  },
  {
    key: "online_booking",
    label: "Réservations en ligne",
    description: "Un client envoie une demande depuis la page de réservation.",
    types: ["reservation_request"],
    requires: "reservations.edit",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  description: string;
  types: readonly string[];
  requires: PermissionKey | null;
}[];

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

const VALID = new Set<string>(NOTIFICATION_CATEGORIES.map((c) => c.key));

export function categoryOfNotificationType(type: string): NotificationCategoryKey | null {
  return NOTIFICATION_CATEGORIES.find((c) => (c.types as readonly string[]).includes(type))?.key ?? null;
}

/// Les catégories proposées à une personne, selon ses droits.
export function visibleNotificationCategories(can: (permission: PermissionKey) => boolean) {
  return NOTIFICATION_CATEGORIES.filter((c) => c.requires === null || can(c.requires));
}

export function parseMuted(csv: string | null | undefined): Set<NotificationCategoryKey> {
  return new Set(
    (csv ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter((k): k is NotificationCategoryKey => VALID.has(k))
  );
}

export function serializeMuted(keys: Iterable<string>): string {
  const set = new Set(keys);
  return NOTIFICATION_CATEGORIES.filter((c) => set.has(c.key))
    .map((c) => c.key)
    .join(",");
}

/// Cette notification doit-elle être créée pour cette personne ? Non si sa catégorie est coupée.
export function isNotificationMuted(mutedCsv: string | null | undefined, type: string): boolean {
  const category = categoryOfNotificationType(type);
  return category !== null && parseMuted(mutedCsv).has(category);
}
