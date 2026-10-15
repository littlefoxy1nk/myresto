"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import {
  getMoveReservationData,
  moveReservation,
  type MoveReservationData,
} from "@/modules/reservations/server/actions";
import {
  applyMoves,
  capacityOfTables,
  conflictsOnTables,
  isMovable,
  planConflicts,
  type DayBooking,
} from "@/modules/reservations/move";

type Table = MoveReservationData["zones"][number]["tables"][number];

export function MoveReservationDialog({
  reservationId,
  onOpenChange,
}: {
  reservationId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<MoveReservationData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState<string[]>([]);
  const [step, setStep] = useState<"choose" | "resolve">("choose");
  const [displacedTargets, setDisplacedTargets] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMoveReservationData(reservationId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  const tableById = useMemo(() => {
    const map = new Map<string, Table>();
    data?.zones.forEach((z) => z.tables.forEach((t) => map.set(t.id, t)));
    return map;
  }, [data]);

  const labels = (ids: string[]) => ids.map((id) => tableById.get(id)?.label ?? "?").join(" + ");
  const capacity = (ids: string[]) =>
    capacityOfTables(ids.map((id) => tableById.get(id)).filter((t): t is Table => !!t));

  if (loadError || !data) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Changer de table</DialogTitle>
          <DialogDescription>{loadError ?? "Chargement…"}</DialogDescription>
        </DialogContent>
      </Dialog>
    );
  }

  const res = data.reservation;
  const bookings = data.bookings;
  const byId = new Map(bookings.map((b) => [b.id, b]));

  const displaced: DayBooking[] = [];
  for (const b of conflictsOnTables(bookings, target, res, [res.id])) {
    if (!displaced.some((d) => d.id === b.id)) displaced.push(b);
  }

  const moves: Record<string, string[]> = { [res.id]: target, ...displacedTargets };
  const everyDisplacedPlaced = displaced.every((d) => (displacedTargets[d.id]?.length ?? 0) > 0);
  const planIsValid =
    target.length > 0 &&
    everyDisplacedPlaced &&
    displaced.every((d) => isMovable(d.status)) &&
    planConflicts(bookings, moves).length === 0;

  const overCapacity = Object.entries(moves)
    .filter(([, ids]) => ids.length > 0)
    .map(([id, ids]) => ({ booking: id === res.id ? { ...res } : byId.get(id)!, capacity: capacity(ids) }))
    .filter((x) => x.capacity < x.booking.partySize);

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function goToResolve() {
    // Par défaut on propose l'échange : l'occupante prend la place libérée par la réservation déplacée.
    const afterMove = applyMoves(bookings, { [res.id]: target });
    const next: Record<string, string[]> = {};
    for (const d of displaced) {
      const swapFree = conflictsOnTables(afterMove, res.tableIds, d, [d.id]).length === 0;
      next[d.id] = swapFree ? res.tableIds : [];
    }
    setDisplacedTargets(next);
    setStep("resolve");
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await moveReservation({
        moves: Object.entries(moves).map(([reservationId, tableIds]) => ({ reservationId, tableIds })),
        allowOverCapacity: overCapacity.length > 0,
      });
      toast(res.tableIds.length === 0 ? "Table attribuée" : displaced.length > 0 ? "Réservations déplacées" : "Réservation déplacée");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogTitle>{res.tableIds.length > 0 ? "Changer de table" : "Choisir une table"}</DialogTitle>
        <DialogDescription>
          {res.customerName} · {res.partySize} pers. · {res.time} ·{" "}
          {res.tableIds.length > 0 ? `actuellement sur ${labels(res.tableIds)}` : "pas encore de table"}
        </DialogDescription>

        {step === "choose" && (
          <div className="mt-4 space-y-4">
            {data.zones.map((zone) => (
              <div key={zone.id} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{zone.name}</p>
                <div className="flex flex-wrap gap-2">
                  {zone.tables.map((t) => {
                    const isCurrent = res.tableIds.includes(t.id);
                    const clashes = conflictsOnTables(bookings, [t.id], res, [res.id]);
                    const locked = t.manualStatus === "unavailable" || clashes.some((c) => !isMovable(c.status));
                    return (
                      <TableChip
                        key={t.id}
                        table={t}
                        selected={target.includes(t.id)}
                        disabled={isCurrent || locked}
                        note={
                          isCurrent
                            ? "actuelle"
                            : t.manualStatus === "unavailable"
                              ? "indisponible"
                              : clashes.length > 0
                                ? `${clashes[0].customerName} · ${clashes[0].time}`
                                : undefined
                        }
                        warn={clashes.length > 0 && !locked}
                        onClick={() => setTarget((prev) => toggle(prev, t.id))}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {target.length > 0 && (
              <p className="text-sm">
                Vers <span className="font-medium">{labels(target)}</span> · {capacity(target)} places
                {displaced.length > 0 && (
                  <span className="text-important">
                    {" "}
                    · occupée par {displaced.map((d) => d.customerName).join(", ")} : tu choisiras où la déplacer
                  </span>
                )}
              </p>
            )}
            {target.length > 0 && displaced.length === 0 && overCapacity.length > 0 && (
              <CapacityWarning items={overCapacity} />
            )}
            {error && <p className="text-sm text-urgent">{error}</p>}

            {displaced.length > 0 ? (
              <Button className="w-full" disabled={target.length === 0} onClick={goToResolve}>
                Continuer
              </Button>
            ) : (
              <Button className="w-full" disabled={target.length === 0 || pending} onClick={confirm}>
                {pending
                  ? "Enregistrement…"
                  : target.length === 0
                    ? "Choisis une table"
                    : `${res.tableIds.length === 0 ? "Attribuer" : "Déplacer sur"} ${res.tableIds.length === 0 ? "la table " : ""}${labels(target)}${overCapacity.length > 0 ? " quand même" : ""}`}
              </Button>
            )}
          </div>
        )}

        {step === "resolve" && (
          <div className="mt-4 space-y-5">
            <p className="text-sm">
              <span className="font-medium">{labels(target)}</span> est déjà prise sur ce créneau. Dis où va chaque
              réservation déplacée.
            </p>

            {displaced.map((d) => {
              const others = Object.fromEntries(
                Object.entries(moves).filter(([id]) => id !== d.id)
              ) as Record<string, string[]>;
              const afterOthers = applyMoves(bookings, others);
              return (
                <div key={d.id} className="space-y-2 rounded-2xl border border-border p-3">
                  <p className="text-sm">
                    <span className="font-medium">{d.customerName}</span>{" "}
                    <span className="text-muted-foreground">
                      · {d.partySize} pers. · {d.time} · sur {labels(d.tableIds)}
                    </span>
                  </p>
                  {!isMovable(d.status) ? (
                    <p className="text-sm text-urgent">Cette réservation est clôturée : elle ne peut pas être déplacée.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Où la mettre ?</p>
                      {data.zones.map((zone) => (
                        <div key={zone.id} className="flex flex-wrap items-center gap-2">
                          <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {zone.name}
                          </span>
                          {zone.tables.map((t) => {
                            const clash =
                              conflictsOnTables(afterOthers, [t.id], d, [d.id])[0] ??
                              (target.includes(t.id) ? { customerName: res.customerName, time: res.time } : undefined);
                            const unavailable = t.manualStatus === "unavailable";
                            const isSwap = res.tableIds.includes(t.id);
                            return (
                              <TableChip
                                key={t.id}
                                table={t}
                                selected={displacedTargets[d.id]?.includes(t.id) ?? false}
                                disabled={unavailable || !!clash}
                                note={
                                  unavailable
                                    ? "indisponible"
                                    : clash
                                      ? `${clash.customerName} · ${clash.time}`
                                      : isSwap
                                        ? "échange"
                                        : undefined
                                }
                                onClick={() =>
                                  setDisplacedTargets((prev) => ({ ...prev, [d.id]: toggle(prev[d.id] ?? [], t.id) }))
                                }
                              />
                            );
                          })}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}

            {overCapacity.length > 0 && <CapacityWarning items={overCapacity} />}
            {error && <p className="text-sm text-urgent">{error}</p>}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("choose")} disabled={pending}>
                <ChevronLeft size={15} aria-hidden="true" />
                Retour
              </Button>
              <Button className="flex-1" disabled={!planIsValid || pending} onClick={confirm}>
                {pending
                  ? "Déplacement…"
                  : overCapacity.length > 0
                    ? "Confirmer quand même"
                    : "Confirmer le déplacement"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CapacityWarning({ items }: { items: { booking: { customerName: string; partySize: number }; capacity: number }[] }) {
  return (
    <p className="rounded-lg bg-important-soft px-3 py-2 text-sm text-important" role="status">
      Conflit de capacité :{" "}
      {items
        .map((i) => `${i.booking.customerName} (${i.booking.partySize} pers. pour ${i.capacity} places)`)
        .join(", ")}
      . Tu peux déplacer quand même.
    </p>
  );
}

function TableChip({
  table,
  selected,
  disabled,
  note,
  warn,
  onClick,
}: {
  table: Table;
  selected: boolean;
  disabled?: boolean;
  note?: string;
  warn?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-2xl border px-3 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
        selected ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted",
        warn && !selected && "border-important/50",
        disabled && "cursor-not-allowed opacity-50 hover:bg-card"
      )}
    >
      <span className="font-medium">{table.label}</span>{" "}
      <span className="text-xs text-muted-foreground">{table.capacity} pl.</span>
      {note && <span className={cn("block text-[11px]", warn ? "text-important" : "text-muted-foreground")}>{note}</span>}
    </button>
  );
}
