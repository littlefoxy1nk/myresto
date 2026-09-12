"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SHIFT_POSITIONS, SHIFT_POSITION_LABELS, type ShiftPosition } from "@/modules/planning/types";
import type { PlanningMember, PlanningServiceDefinition } from "@/modules/planning/types";

export type ShiftFormValues = {
  membershipId: string;
  serviceId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  position: ShiftPosition;
};

export function ShiftFormDialog({
  open,
  onOpenChange,
  members,
  services,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: PlanningMember[];
  services: PlanningServiceDefinition[];
  initial: Partial<ShiftFormValues>;
  onSave: (values: ShiftFormValues) => Promise<void>;
  onDelete?: () => void;
}) {
  const [membershipId, setMembershipId] = useState(initial.membershipId ?? "");
  const [serviceId, setServiceId] = useState<string | null>(initial.serviceId ?? null);
  const [date, setDate] = useState(initial.date ?? "");
  const [startTime, setStartTime] = useState(initial.startTime ?? "18:00");
  const [endTime, setEndTime] = useState(initial.endTime ?? "23:00");
  const [position, setPosition] = useState<ShiftPosition>((initial.position as ShiftPosition) ?? "salle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!onDelete;
  const valid = !!membershipId && !!date && !!startTime && !!endTime;

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
