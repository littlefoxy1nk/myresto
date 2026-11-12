import { POSITIONS_BY_ZONE } from "@/modules/planning/types";

/// À qui s'adresse un message : toute l'équipe, ou seulement la salle (salle + bar) ou la cuisine (cuisine + plonge).
/// Le groupe d'une personne vient de ses compétences (celles de sa fiche) : explicable, rien de deviné.
export type Audience = "all" | "salle" | "cuisine";

export const AUDIENCES: { key: Audience; label: string }[] = [
  { key: "all", label: "Toute l'équipe" },
  { key: "salle", label: "La salle" },
  { key: "cuisine", label: "La cuisine" },
];

export function isAudience(value: unknown): value is Audience {
  return value === "all" || value === "salle" || value === "cuisine";
}

export function audienceLabel(audience: string): string {
  return AUDIENCES.find((a) => a.key === audience)?.label ?? "Toute l'équipe";
}

/// Cette personne fait-elle partie du public du message ? Une personne sans compétence renseignée ne reçoit que les
/// messages « toute l'équipe » (on ne devine pas son groupe).
export function memberInAudience(audience: string, member: { skills: string | null }): boolean {
  if (audience === "all") return true;
  if (audience !== "salle" && audience !== "cuisine") return false;
  const skills = (member.skills ?? "").split(",").map((s) => s.trim());
  return POSITIONS_BY_ZONE[audience].some((position) => skills.includes(position));
}
