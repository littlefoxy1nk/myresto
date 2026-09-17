// Types du remplacement de service. Volontairement indépendants de Prisma — même
// convention que planning/compute.ts et workload/compute.ts — pour que l'éligibilité
// reste une fonction pure et testable.

export type CandidateInput = {
  membershipId: string;
  /// Compétences déclarées (voir Membership.skills) — une liste vide signifie "non
  /// renseigné", jamais "ne convient à aucun poste" : on ne exclut pas sur une absence
  /// de donnée.
  skills: string[];
  hasApprovedLeaveOnDate: boolean;
  hasOverlappingShift: boolean;
};

export type EligibleCandidate = {
  membershipId: string;
  firstName: string;
  lastName: string;
  hasVolunteered: boolean;
};

export type ReplacementRequestItem = {
  id: string;
  shiftId: string;
  status: "open" | "resolved";
  requestedByMembershipId: string;
  requestedByName: string;
  date: string; // "yyyy-MM-dd"
  dateLabel: string;
  startTime: string;
  endTime: string;
  position: string;
  reason: string | null;
  candidates: EligibleCandidate[];
  resolvedMembershipId: string | null;
};

export type MyReplacementOpportunity = {
  requestId: string;
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  position: string;
  requestedByName: string;
  hasVolunteered: boolean;
};
