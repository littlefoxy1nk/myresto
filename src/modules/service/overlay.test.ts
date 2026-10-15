import { test } from "node:test";
import assert from "node:assert/strict";
import { overlayRealTimeStates } from "./overlay";
import type { TableWithLiveState, ZoneWithTables } from "@/modules/floorplan/types";

const res = (id: string) => ({ id, customerName: id, partySize: 2, time: "18:00", status: "seated", minutesFromNow: 0 });
const table = (id: string, liveState: TableWithLiveState["liveState"], reservation: string | null = null): TableWithLiveState => ({
  id, zoneId: "z", label: id, capacity: 2, shape: "square", posX: 0, posY: 0, width: 80, height: 80,
  manualStatus: "available", liveState, activeReservation: reservation ? res(reservation) : null, group: null,
});
const zone = (tables: TableWithLiveState[]): ZoneWithTables => ({ id: "z", name: "Salle", type: "salle", sortOrder: 0, tables });

test("une table occupée maintenant apparaît occupée dans le plan du service à venir", () => {
  const out = overlayRealTimeStates([zone([table("T1", "available"), table("T2", "reserved", "soir")])], [zone([table("T1", "occupied", "walkin"), table("T2", "available")])]);
  assert.equal(out[0].tables[0].liveState, "occupied");
  assert.equal(out[0].tables[0].activeReservation?.id, "walkin");
});

test("à nettoyer et indisponible sont repris aussi", () => {
  const out = overlayRealTimeStates([zone([table("T1", "available"), table("T2", "available")])], [zone([table("T1", "cleaning"), table("T2", "unavailable")])]);
  assert.deepEqual(out[0].tables.map((t) => t.liveState), ["cleaning", "unavailable"]);
});

test("libre / bientôt / réservée en direct ne remplacent PAS l'état du service à venir", () => {
  const out = overlayRealTimeStates([zone([table("T1", "reserved", "soir")])], [zone([table("T1", "available")])]);
  assert.equal(out[0].tables[0].liveState, "reserved");
  assert.equal(out[0].tables[0].activeReservation?.id, "soir");
});

test("table absente du plan en direct : inchangée", () => {
  const out = overlayRealTimeStates([zone([table("T1", "reserved", "soir")])], [zone([])]);
  assert.equal(out[0].tables[0].liveState, "reserved");
});
