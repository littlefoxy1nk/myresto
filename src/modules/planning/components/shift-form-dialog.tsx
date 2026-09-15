"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { evaluateShift, checkWeeklyLimit } from "@/modules/planning/compute";
import { SHIFT_POSITIONS, SHIFT_POSITION_LABELS, type ShiftPosition } from "@/modules/planning/types";
import type { AvailabilityRow, PlanningMember, PlanningServiceDefinition, PlanningShift } from "@/modules/planning/types";

export type ShiftFormValues = {
  membershipId: string;
  serviceId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  position: ShiftPosition;
};

function isoDayOfWeek(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 7 : day;
}

export function ShiftFormDialog({
  open,
  onOpenChange,
  members,
  services,
  initial,
  editingShiftId,
  allShifts,
  availabilitiesByMember,
  absentMembershipIdsByDate,
  shiftsCountByMember,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: PlanningMember[];
  services: PlanningServiceDefinition[];
  initial: Partial<ShiftFormValues>;
  editingShiftId: string | null;
  allShifts: PlanningShift[];
  availabilitiesByMember: Record<string, AvailabilityRow[]>;
  absentMembershipIdsByDate: Record<string, string[]>;
  shiftsCountByMember: Record<string, number>;
  onSave: (values: ShiftFormValues) => Promise<void>;
  onDelete?: () => void;
}) {
  const initialMembershipId = initial.membershipId ?? "";
  const [membershipId, setMembershipId] = useState(initialMembershipId);
  const [serviceId, setServiceId] = useState<string | null>(initial.serviceId ?? null);
  const [date, setDate] = useState(initial.date ?? "");
  const [startTime, setStartTime] = useState(initial.startTime ?? "18:00");
  const [endTime, setEndTime] = useState(initial.endTime ?? "23:00");
  const [position, setPosition] = useState<ShiftPosition>((initial.position as ShiftPosition) ?? "salle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!onDelete;
  const valid = !!membershipId && !!date && !!startTime && !!endTime;

  // Aperçu en temps réel — la même fonction qui calcule l'état persisté des shifts
  // existants (evaluateShift, compute.ts) tourne ici avant tout enregistrement, pour
  // avertir le manager sans jamais bloquer la saisie.
  const liveWarnings = useMemo(() => {
    if (!membershipId || !date || !startTime || !endTime) return [];

    const otherShiftsSameDay = allShifts
      .filter((s) => s.membershipId === membershipId && s.date === date && s.id !== editingShiftId)
      .map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
    const isAbsentThatDay = (absentMembershipIdsByDate[date] ?? []).includes(membershipId);
    const isoDay = isoDayOfWeek(date);
    const availabilities = (availabilitiesByMember[membershipId] ?? []).filter((a) => a.dayOfWeek === isoDay);

    const evaluation = evaluateShift({ startTime, endTime }, { otherShiftsSameDay, isAbsentThatDay, availabilities });
    const warnings = [...evaluation.warnings];

    const member = members.find((m) => m.membershipId === membershipId);
    const isSameMemberAsOriginal = editingShiftId != null && membershipId === initialMembershipId;
    const otherCount = shiftsCountByMember[membershipId] ?? 0;
    const adjustedOtherCount = isSameMemberAsOriginal ? Math.max(otherCount - 1, 0) : otherCount;
    const limitMessage = member ? checkWeeklyLimit(adjustedOtherCount, member.maxShiftsPerWeek) : null;
    if (limitMessage) warnings.push({ level: "warning", message: limitMessage });

    return warnings;
  }, [
    membershipId,
    date,
    startTime,
    endTime,
    allShifts,
    editingShiftId,
    absentMembershipIdsByDate,
    availabilitiesByMember,
    members,
    initialMembershipId,
    shiftsCountByMember,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{isEditing ? "Modifier le shift" : "Nouveau shift"}</DialogTitle>
        <DialogDescription>
          {isEditing ? "Ajustez les horaires, le service ou la position." : "Planifiez un créneau pour un membre de l'équipe."}
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setPending(true);
            setError(null);
            try {
              await onSave({ membershipId, serviceId, date, startTime, endTime, position });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="shift-member" className="text-sm font-medium">
              Membre
            </label>
            <select
              id="shift-member"
              value={membershipId}
              onChange={(e) => setMembershipId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="" disabled>
                Choisir une personne
              </option>
              {members.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>
                  {m.firstName} {m.lastName}
                  {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="shift-date" className="text-sm font-medium">
                Date
              </label>
              <input
                id="shift-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="shift-service" className="text-sm font-medium">
                Service
              </label>
              <select
                id="shift-service"
                value={serviceId ?? ""}
                onChange={(e) => setServiceId(e.target.value || null)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">Aucun</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="shift-start" className="text-sm font-medium">
                Début
              </label>
              <input
                id="shift-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="shift-end" className="text-sm font-medium">
                Fin
              </label>
              <input
                id="shift-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Position</span>
            <div className="grid grid-cols-4 gap-2">
              {SHIFT_POSITIONS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPosition(p)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    position === p ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  }`}
                >
                  {SHIFT_POSITION_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {liveWarnings.length > 0 && (
            <div className="space-y-1.5">
              {liveWarnings.map((w) => (
                <div
                  key={w.message}
                  className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                    w.level === "conflict" ? "bg-urgent-soft text-urgent" : "bg-important-soft text-important"
                  }`}
                >
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-urgent">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {isEditing && (
              <Button type="button" variant="ghost" className="text-urgent hover:bg-urgent-soft" onClick={onDelete}>
                Supprimer
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={pending || !valid}>
              {pending ? "Enregistrement…" : isEditing ? "Enregistrer" : "Créer le shift"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
