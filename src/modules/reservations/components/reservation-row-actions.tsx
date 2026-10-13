"use client";

import { useState, useTransition } from "react";
import { Pencil, Ban, UserX, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MoveReservationDialog } from "@/modules/reservations/components/move-reservation-dialog";
import { SpanNextService, type ServiceWithDays } from "@/modules/reservations/components/span-next-service";
import { toast } from "@/lib/toast-bus";
import { updateReservationStatus, updateReservationDetails } from "@/modules/reservations/server/actions";

type EditInitial = {
  partySize: number;
  date: string;
  time: string;
  durationMinutes: number;
  notes: string;
  specialRequests: string;
  spansNextService: boolean;
  blocksEvening: boolean;
};

export function ReservationRowActions({
  reservationId,
  showNoShow,
  editInitial,
  services,
}: {
  reservationId: string;
  showNoShow: boolean;
  editInitial: EditInitial;
  services: ServiceWithDays[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [pending, startTransition] = useTransition();

  function setStatus(status: "cancelled" | "no_show", successMessage: string) {
    startTransition(async () => {
      try {
        await updateReservationStatus(reservationId, status);
        toast(successMessage);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} aria-label="Modifier la réservation">
        <Pencil size={14} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)} aria-label="Changer de table">
        <ArrowRightLeft size={14} aria-hidden="true" />
      </Button>
      {showNoShow && (
        <Button
          variant="ghost"
          size="sm"
          className="text-urgent hover:bg-urgent-soft"
          onClick={() => setConfirmNoShow(true)}
          disabled={pending}
        >
          <UserX size={14} aria-hidden="true" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:bg-muted"
        onClick={() => setConfirmCancel(true)}
        disabled={pending}
        aria-label="Annuler la réservation"
      >
        <Ban size={14} aria-hidden="true" />
      </Button>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Annuler cette réservation ?"
        description="La table redevient disponible pour ce créneau."
        confirmLabel="Annuler la réservation"
        onConfirm={() => setStatus("cancelled", "Réservation annulée")}
      />
      <ConfirmDialog
        open={confirmNoShow}
        onOpenChange={setConfirmNoShow}
        title="Marquer comme no-show ?"
        description="Le client n'est jamais arrivé pour cette réservation."
        confirmLabel="Marquer no-show"
        onConfirm={() => setStatus("no_show", "Réservation marquée no-show")}
      />
      {moveOpen && <MoveReservationDialog reservationId={reservationId} onOpenChange={setMoveOpen} />}
      {editOpen && (
        <EditReservationDialog
          reservationId={reservationId}
          initial={editInitial}
          services={services}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}

function EditReservationDialog({
  reservationId,
  initial,
  services,
  onOpenChange,
}: {
  reservationId: string;
  initial: EditInitial;
  services: ServiceWithDays[];
  onOpenChange: (open: boolean) => void;
}) {
  const [partySize, setPartySize] = useState(initial.partySize);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [spansNextService, setSpansNextService] = useState(initial.spansNextService);
  const [notes, setNotes] = useState(initial.notes);
  const [specialRequests, setSpecialRequests] = useState(initial.specialRequests);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Modifier la réservation</DialogTitle>
        <DialogDescription>Les tables déjà assignées restent inchangées.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            try {
              await updateReservationDetails(reservationId, {
                partySize,
                date,
                time,
                // Décocher "bloquer le service suivant" ramène la durée à la normale (90 min).
                durationMinutes: !spansNextService && initial.spansNextService && !initial.blocksEvening ? 90 : durationMinutes,
                spansNextService,
                blocksEvening: initial.blocksEvening,
                notes,
                specialRequests,
              });
              toast("Réservation modifiée");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-party-size" className="text-sm font-medium">
                Personnes
              </label>
              <input
                id="edit-party-size"
                type="number"
                min={1}
                max={60}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-duration" className="text-sm font-medium">
                Durée (min)
              </label>
              <input
                id="edit-duration"
                type="number"
                min={15}
                max={480}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-date" className="text-sm font-medium">
                Date
              </label>
              <input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-time" className="text-sm font-medium">
                Heure
              </label>
              <input
                id="edit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>
          <SpanNextService
            services={services}
            date={date}
            time={time}
            checked={spansNextService}
            onChange={setSpansNextService}
          />
          <div className="space-y-1.5">
            <label htmlFor="edit-special" className="text-sm font-medium">
              Demandes spéciales
            </label>
            <input
              id="edit-special"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-notes" className="text-sm font-medium">
              Notes internes
            </label>
            <input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
