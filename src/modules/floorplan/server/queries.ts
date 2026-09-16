import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, isSameDay } from "date-fns";
import { timeToMinutes } from "@/lib/time";
import { computeTableLiveState, computeSlotAvailability, type ReservationForStateCalc } from "./table-state";
import type {
  ZoneWithTables,
  TableManualStatus,
  TableShape,
  ZoneType,
} from "@/modules/floorplan/types";

type GroupInfo = { id: string; label: string | null; combinedCapacity: number; tableIds: string[] };

async function fetchZonesAndGroups(establishmentId: string, at: Date) {
  const [zones, groups] = await Promise.all([
    prisma.zone.findMany({
      where: { establishmentId },
      include: { tables: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tableGroup.findMany({
      where: {
        establishmentId,
        activeFrom: { lte: at },
        OR: [{ activeUntil: null }, { activeUntil: { gte: at } }],
      },
      include: { members: true },
    }),
  ]);

  const groupByTable = new Map<string, GroupInfo>();
  for (const g of groups) {
    const tableIds = g.members.map((m) => m.tableId);
    const info: GroupInfo = { id: g.id, label: g.label, combinedCapacity: g.combinedCapacity, tableIds };
    for (const tableId of tableIds) groupByTable.set(tableId, info);
  }

  return { zones, groupByTable };
}

function reservationsByTableMap(
  reservations: Array<{
    id: string;
    customerName: string;
    partySize: number;
    time: string;
    status: string;
    durationMinutes: number;
    tables: { tableId: string }[];
  }>
) {
  const map = new Map<string, ReservationForStateCalc[]>();
  for (const r of reservations) {
    const entry: ReservationForStateCalc = {
      id: r.id,
      customerName: r.customerName,
      partySize: r.partySize,
      time: r.time,
      status: r.status,
      durationMinutes: r.durationMinutes,
    };
    for (const rt of r.tables) {
      const list = map.get(rt.tableId) ?? [];
      list.push(entry);
      map.set(rt.tableId, list);
    }
  }
  return map;
}

/// Lit tout ce qu'il faut pour afficher le plan de salle "maintenant" : zones, tables,
/// état live calculé à partir des réservations du jour, et appartenance à un groupe de
/// tables actif. C'est la fonction que la page appelle ; le calcul d'état lui-même
/// (table-state.ts) est pur et pourra être réutilisé par le futur Mode Service.
///
/// Politique de permission DÉLIBÉRÉE, à ne pas "uniformiser" par un ajout naïf : cette
/// fonction est partagée par deux appelants légitimes qui n'ont pas la même permission
/// (plan-de-salle exige floorplan.view, Mode Service exige service.run) — elle reste
/// donc volontairement permission-agnostique, et c'est à CHAQUE appelant de vérifier son
/// propre droit avant de l'appeler (voir plan-de-salle/page.tsx et service/server/queries.ts).
/// Contrairement aux autres query functions de sensibilité comparable, ne PAS lui ajouter
/// un self-check sur une permission unique — ce serait bloquer l'un des deux appelants.
export async function getFloorPlan(establishmentId: string): Promise<ZoneWithTables[]> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const [{ zones, groupByTable }, reservations] = await Promise.all([
    fetchZonesAndGroups(establishmentId, now),
    prisma.reservation.findMany({
      where: {
        establishmentId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["cancelled"] },
      },
      include: { tables: true },
    }),
  ]);

  const reservationsByTable = reservationsByTableMap(reservations);

  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    type: zone.type as ZoneType,
    sortOrder: zone.sortOrder,
    tables: zone.tables.map((t) => {
      const { liveState, activeReservation } = computeTableLiveState(
        t.status as TableManualStatus,
        reservationsByTable.get(t.id) ?? [],
        now
      );
      return {
        id: t.id,
        zoneId: t.zoneId,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape as TableShape,
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
        manualStatus: t.status as TableManualStatus,
        liveState,
        activeReservation,
        group: groupByTable.get(t.id) ?? null,
      };
    }),
  }));
}

/// Même forme que getFloorPlan, mais pour un créneau choisi par l'utilisateur (pas
/// "maintenant") — utilisé par le flux de création de réservation pour savoir quelles
/// tables sont réellement libres à l'heure demandée, et nourrir le moteur de suggestion
/// (suggestions.ts) sans que celui-ci ait besoin de connaître la notion de créneau.
export async function getFloorPlanForSlot(
  establishmentId: string,
  date: Date,
  time: string,
  durationMinutes: number,
  excludeReservationId?: string
): Promise<ZoneWithTables[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const isToday = isSameDay(date, new Date());
  const requestedStartMinutes = timeToMinutes(time);

  const [{ zones, groupByTable }, reservations] = await Promise.all([
    fetchZonesAndGroups(establishmentId, date),
    prisma.reservation.findMany({
      where: {
        establishmentId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["cancelled"] },
      },
      include: { tables: true },
    }),
  ]);

  const reservationsByTable = reservationsByTableMap(reservations);

  const tablesFlat = zones.flatMap((zone) =>
    zone.tables.map((t) => {
      const { liveState, activeReservation } = computeSlotAvailability(
        t.status as TableManualStatus,
        reservationsByTable.get(t.id) ?? [],
        requestedStartMinutes,
        durationMinutes,
        isToday,
        excludeReservationId
      );
      return { table: t, liveState, activeReservation };
    })
  );

  // Un groupe n'est réservable comme unité que si TOUS ses membres sont libres sur le
  // créneau — sinon on ne peut pas proposer "T12 + T13" alors que T13 est déjà prise.
  const unavailableGroupIds = new Set<string>();
  for (const { table, liveState } of tablesFlat) {
    const group = groupByTable.get(table.id);
    if (group && liveState !== "available") unavailableGroupIds.add(group.id);
  }

  const stateByTableId = new Map(
    tablesFlat.map(({ table, liveState, activeReservation }) => {
      const group = groupByTable.get(table.id);
      if (group && liveState === "available" && unavailableGroupIds.has(group.id)) {
        return [table.id, { liveState: "occupied" as const, activeReservation: null }];
      }
      return [table.id, { liveState, activeReservation }];
    })
  );

  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    type: zone.type as ZoneType,
    sortOrder: zone.sortOrder,
    tables: zone.tables.map((t) => {
      const computed = stateByTableId.get(t.id)!;
      return {
        id: t.id,
        zoneId: t.zoneId,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape as TableShape,
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
        manualStatus: t.status as TableManualStatus,
        liveState: computed.liveState,
        activeReservation: computed.activeReservation,
        group: groupByTable.get(t.id) ?? null,
      };
    }),
  }));
}
