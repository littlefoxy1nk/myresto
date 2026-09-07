import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { computeWorkloadSummary } from "@/modules/workload/compute";
import type { WorkloadReservation, WorkloadSummary, WorkloadZoneInput } from "@/modules/workload/types";

/// Assemble les données réelles (réservations du jour, tables par zone, personnel
/// affecté) et délègue tout le calcul à computeWorkloadSummary — cette fonction ne fait
/// que la lecture et la mise en forme, aucune règle métier n'est dupliquée ici.
export async function getWorkloadSummary(establishmentId: string, date: Date = new Date()): Promise<WorkloadSummary> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [reservations, zones, assignmentCounts] = await Promise.all([
    prisma.reservation.findMany({
      where: { establishmentId, date: { gte: dayStart, lte: dayEnd }, status: { notIn: ["cancelled", "no_show"] } },
      include: { tables: { include: { table: true } } },
    }),
    prisma.zone.findMany({
      where: { establishmentId },
      include: { _count: { select: { tables: true } } },
    }),
    prisma.staffAssignment.groupBy({
      by: ["zoneId"],
      where: { establishmentId, tableId: null },
      _count: { membershipId: true },
    }),
  ]);

  const staffCountByZone = new Map(assignmentCounts.map((a) => [a.zoneId, a._count.membershipId]));

  const workloadReservations: WorkloadReservation[] = reservations.map((r) => ({
    time: r.time,
    partySize: r.partySize,
    zoneId: r.tables[0]?.table.zoneId ?? null,
  }));

  const workloadZones: WorkloadZoneInput[] = zones.map((z) => ({
    id: z.id,
    name: z.name,
    tablesCount: z._count.tables,
    assignedStaffCount: staffCountByZone.get(z.id) ?? 0,
  }));

  return computeWorkloadSummary(workloadReservations, workloadZones);
}
