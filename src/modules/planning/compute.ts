import type { DemandLevel, PlanningAlert, PlanningDayService } from "./types";

/// Fonctions métier pures du Planning — aucun accès base de données. C'est le même
/// principe que src/modules/workload/compute.ts : un seul endroit qui sait calculer
/// des heures, des chevauchements et un niveau de charge, jamais réécrit ailleurs.

export function computeShiftDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function shiftsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

/// Détecte, parmi les shifts d'UNE même personne pour UN même jour, ceux qui se
/// chevauchent. Renvoie les ids concernés : c'est un signal d'alerte affiché sur le
/// shift, pas un blocage — un manager peut avoir une vraie raison de superposer deux
/// shifts (passation, double casquette).
export function detectOverlappingShiftIds(shifts: { id: string; startTime: string; endTime: string }[]): Set<string> {
  const overlapping = new Set<string>();
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (shiftsOverlap(shifts[i], shifts[j])) {
        overlapping.add(shifts[i].id);
        overlapping.add(shifts[j].id);
      }
    }
  }
  return overlapping;
}

// Le ratio couverts / capacité totale de la salle objective la densité de la demande
// sur l'espace physique pour un service complet (qui peut compter plusieurs tournées).
// Ce n'est PAS un calcul de personnel : aucune règle du type "1 serveur pour X couverts"
// n'intervient ici, volontairement — voir Mission 5 (Planning RH V1). Le jugement sur
// l'effectif nécessaire reste humain ; ceci ne fait qu'objectiver un des deux côtés
// de la comparaison que le manager doit faire lui-même.
const DEMAND_RATIO_MODERATE = 1;
const DEMAND_RATIO_HIGH = 2;

export function computeDemandLevel(covers: number, totalCapacity: number): DemandLevel {
  if (totalCapacity <= 0) return "indeterminee";
  const ratio = covers / totalCapacity;
  if (ratio <= DEMAND_RATIO_MODERATE) return "faible";
  if (ratio <= DEMAND_RATIO_HIGH) return "moderee";
  return "elevee";
}

// Seuils simples et transparents pour les alertes de cohérence — pas une prescription
// d'effectif "idéal", juste des situations qui méritent un regard humain. Appliqués au
// personnel de salle uniquement (floorStaffCount) : la cuisine, le bar et la direction
// ne varient pas avec le nombre de couverts de la même façon, les mélanger fausserait
// la comparaison.
const UNDERSTAFFED_MAX_FLOOR_STAFF = 1;
const OVERSTAFFED_MIN_FLOOR_STAFF = 4;

/// Croise demande attendue et personnel planifié pour émettre des alertes simples.
/// Fonction pure : reçoit des PlanningDayService déjà assemblés, ne touche pas la base.
export function computePlanningAlerts(dayServices: PlanningDayService[]): PlanningAlert[] {
  const alerts: PlanningAlert[] = [];

  for (const ds of dayServices) {
    for (const person of ds.absentScheduled) {
      alerts.push({
        id: `absence-${ds.date}-${ds.serviceId}-${person.membershipId}`,
        severity: "urgent",
        title: `${person.name} est planifié(e) mais absent(e)`,
        description: `${ds.serviceName} · ${ds.dateLabel}`,
      });
    }

    const hasDemand = ds.covers > 0 || ds.reservationsCount > 0;
    if (ds.staffCount === 0 && hasDemand) {
      alerts.push({
        id: `no-staff-${ds.date}-${ds.serviceId}`,
        severity: "urgent",
        title: "Aucun personnel planifié",
        description: `${ds.serviceName} · ${ds.dateLabel} — ${ds.covers} couvert${ds.covers > 1 ? "s" : ""} prévu${ds.covers > 1 ? "s" : ""}.`,
      });
      continue; // à 0 personne, l'alerte "peu de personnel" ci-dessous ferait doublon
    }

    if (ds.demandLevel === "elevee" && ds.floorStaffCount <= UNDERSTAFFED_MAX_FLOOR_STAFF) {
      alerts.push({
        id: `understaffed-${ds.date}-${ds.serviceId}`,
        severity: "important",
        title: "Forte demande, personnel de salle réduit",
        description: `${ds.serviceName} · ${ds.dateLabel} — ${ds.covers} couverts prévus pour ${ds.floorStaffCount} personne${ds.floorStaffCount > 1 ? "s" : ""} en salle.`,
      });
    }

    if (ds.demandLevel === "faible" && ds.floorStaffCount >= OVERSTAFFED_MIN_FLOOR_STAFF) {
      alerts.push({
        id: `overstaffed-${ds.date}-${ds.serviceId}`,
        severity: "watch",
        title: "Personnel de salle important, faible demande",
        description: `${ds.serviceName} · ${ds.dateLabel} — ${ds.floorStaffCount} personnes en salle pour ${ds.covers} couvert${ds.covers > 1 ? "s" : ""} prévu${ds.covers > 1 ? "s" : ""}.`,
      });
    }
  }

  const severityRank: Record<PlanningAlert["severity"], number> = { urgent: 0, important: 1, watch: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
