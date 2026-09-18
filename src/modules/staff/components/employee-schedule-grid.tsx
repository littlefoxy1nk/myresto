"use client";

import { EditableServiceGrid, ReadOnlyServiceGrid, type AvailabilityGridService } from "@/components/availability/editable-service-grid";
import { setEmployeeUsualAvailability, setEmployeeUsualAvailabilityBulk } from "@/modules/staff/server/actions";

/// Horaire habituel d'un·e employé·e fixe, déclaré et modifiable par le manager depuis
/// la fiche employé — pour un·e flexijob, la personne le déclare elle-même depuis
/// mon-espace (voir myspace/components/availability-toggles.tsx) : cette grille reste
/// alors en lecture seule ici, pour ne jamais laisser croire au manager qu'il édite
/// une donnée qu'il ne maîtrise plus.
export function EmployeeScheduleGrid({
  membershipId,
  employmentType,
  canEdit,
  services,
  initialCells,
}: {
  membershipId: string;
  employmentType: "fixe" | "flexijob";
  /// Le viewer a staff.manage ET la personne est fixe — sinon toujours lecture seule,
  /// même pour quelqu'un qui a staff.view sans staff.manage (l'action serveur refuse
  /// déjà l'écriture, mais on ne montre pas des boutons voués à échouer).
  canEdit: boolean;
  services: AvailabilityGridService[];
  initialCells: { dayOfWeek: number; serviceId: string }[];
}) {
  if (!canEdit) {
    return (
      <ReadOnlyServiceGrid
        services={services}
        cells={initialCells}
        emptyMessage={
          employmentType === "flexijob"
            ? "Cette personne (flexijob) n'a pas encore déclaré d'horaire habituel."
            : "Aucun horaire habituel déclaré pour le moment."
        }
      />
    );
  }

  return (
    <EditableServiceGrid
      services={services}
      initialCells={initialCells}
      onToggleOne={(dayOfWeek, serviceId, next) => setEmployeeUsualAvailability(membershipId, dayOfWeek, serviceId, next)}
      onToggleMany={(dayOfWeek, serviceIds, next) => setEmployeeUsualAvailabilityBulk(membershipId, dayOfWeek, serviceIds, next)}
    />
  );
}
