"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { shiftsOverlap } from "@/modules/planning/compute";
import { requestCoverage } from "@/modules/planning/server/actions";
import { SHIFT_POSITION_LABELS, STAFFABLE_POSITIONS } from "@/modules/planning/types";
import type { PlanningMember, PlanningShift, ShiftPosition } from "@/modules/planning/types";

/// Demande ciblée à une personne qui n'est PAS planifiée ce créneau-là — jamais une
/// assignation directe (voir requestCoverage) : elle garde la main, voir
/// coverage-requests-list.tsx côté employé. La liste ne propose que les personnes qui
/// tiennent le poste demandé et ne sont pas déjà occupées à cette heure-là ce jour-là ;
/// elle ne filtre jamais par disponibilité déclarée — tout l'intérêt est de solliciter
/// quelqu'un au-delà de son horaire habituel.
export function RequestCoverageDialog({
  open,
  onOpenChange,
  members,
  allShifts,
  date,
  dateLabel,
  serviceId,
  serviceName,
  startTime,
  endTime,
  initialPosition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: PlanningMember[];
  allShifts: PlanningShift[];
  date: string;
  dateLabel: string;
  serviceId: string | null;
  serviceName: string | null;
  startTime: string;
  endTime: string;
  initialPosition: ShiftPosition;
}) {
  const [position, setPosition] = useState<ShiftPosition>(initialPosition);
  const [membershipId, setMembershipId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busyIds = new Set(
    allShifts
      .filter((s) => s.date === date && shiftsOverlap(s, { startTime, endTime }))
      .map((s) => s.membershipId)
  );
  const candidates = members.filter((m) => m.positions.includes(position) && !busyIds.has(m.membershipId));

  async function submit() {
    if (!membershipId) return;
    setPending(true);
    setError(null);
    try {
      await requestCoverage({ membershipId, date, serviceId, startTime, endTime, position });
      toast("Demande envoyée");
      onOpenChange(false);
      setMembershipId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Demander un renfort</DialogTitle>
        <DialogDescription>
          {dateLabel} · {startTime}–{endTime}
          {serviceName ? ` · ${serviceName}` : ""} — la personne choisie reçoit une notification et décide elle-même.
        </DialogDescription>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Poste</span>
            <div className="grid grid-cols-4 gap-2">
              {STAFFABLE_POSITIONS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => {
                    setPosition(p);
                    setMembershipId("");
                  }}
                  className={`rounded-2xl border px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    position === p ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  }`}
                >
                  {SHIFT_POSITION_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Personne de disponible à solliciter : tout le monde qui tient ce poste est déjà occupé ce créneau-là.
            </p>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="coverage-member" className="text-sm font-semibold">
                Qui solliciter ?
              </label>
              <select
                id="coverage-member"
                value={membershipId}
                onChange={(e) => setMembershipId(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
              >
                <option value="" disabled>
                  Choisir une personne
                </option>
                {candidates.map((m) => (
                  <option key={m.membershipId} value={m.membershipId}>
                    {m.firstName} {m.lastName}
                    {m.employmentType === "flexijob" ? " · Flexijob" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button className="w-full" disabled={pending || !membershipId} onClick={submit}>
            {pending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
