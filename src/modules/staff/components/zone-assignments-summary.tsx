import type { ZoneAssignments } from "@/modules/staff/server/assignments";

/// Lecture pure "qui travaille où" — pas de logique, juste l'affichage attendu par le
/// critère de réussite de la mission : comprendre en quelques secondes qui couvre quoi.
export function ZoneAssignmentsSummary({ zones }: { zones: ZoneAssignments[] }) {
  const withStaff = zones.filter((z) => z.members.length > 0);

  if (withStaff.length === 0) {
    return <p className="text-sm text-muted-foreground">Personne n&apos;est encore affecté à une zone.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {withStaff.map((zone) => (
        <li key={zone.zoneId} className="flex items-center gap-2 text-sm">
          <span className="font-medium">{zone.zoneName}</span>
          <span className="text-muted-foreground">
            {zone.members.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
