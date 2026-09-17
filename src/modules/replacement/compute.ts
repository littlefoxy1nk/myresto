import type { CandidateInput } from "./types";

/// Fonction pure : aucun accès base de données. Éligibilité purement factuelle —
/// poste/compétences compatibles, pas de chevauchement, pas de congé approuvé ce
/// jour-là — jamais un score ou un classement. Voir la règle produit : l'automatisation
/// doit rester explicable et contrôlable, jamais une recommandation IA.
export function isEligibleCandidate(candidate: CandidateInput, shiftPosition: string): boolean {
  if (candidate.hasApprovedLeaveOnDate) return false;
  if (candidate.hasOverlappingShift) return false;
  if (candidate.skills.length > 0 && !candidate.skills.includes(shiftPosition)) return false;
  return true;
}
