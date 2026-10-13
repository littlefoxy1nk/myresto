"use client";

import { useState, useTransition } from "react";
import { MessageSquare, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { updateReservationStatus } from "@/modules/reservations/server/actions";
import { MessageDialog, type MessageRecipient } from "@/modules/reservations/components/message-dialog";
import { MoveReservationDialog } from "@/modules/reservations/components/move-reservation-dialog";
import type { MessageKind } from "@/modules/messaging/templates";

type Common = { dateLabel: string; restaurantName: string };

/// Bouton de la barre du jour : prépare le message pour toutes les réservations affichées.
export function DayMessageButton({ recipients, ...common }: Common & { recipients: MessageRecipient[] }) {
  const [open, setOpen] = useState(false);
  if (recipients.length === 0) return null;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <MessageSquare size={14} aria-hidden="true" />
        Demander confirmation
      </Button>
      {open && <MessageDialog recipients={recipients} {...common} onOpenChange={setOpen} />}
    </>
  );
}

/// Message à un seul client (icône sur la ligne de la réservation).
export function RowMessageButton({
  recipient,
  initialKind = "ask",
  ...common
}: Common & { recipient: MessageRecipient; initialKind?: MessageKind }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Envoyer un message au client">
        <MessageSquare size={14} aria-hidden="true" />
      </Button>
      {open && (
        <MessageDialog recipients={[recipient]} initialKind={initialKind} {...common} onOpenChange={setOpen} />
      )}
    </>
  );
}

/// "Confirmer" : passe la réservation en confirmée, puis propose aussitôt le message
/// "réservation confirmée" au client s'il a un téléphone ou un email. Reste monté après la
/// confirmation (le bouton se cache, le dialogue non) : la ligne change de statut au rafraîchissement.
export function ConfirmAndNotifyButton({
  recipient,
  status,
  ...common
}: Common & { recipient: MessageRecipient; status: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      {status === "new" && (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await updateReservationStatus(recipient.id, "confirmed");
                toast("Réservation confirmée");
                if (recipient.phone || recipient.email) setOpen(true);
              } catch {
                toast("Impossible d'enregistrer les modifications", "error");
              }
            })
          }
        >
          {pending ? "…" : "Confirmer"}
        </Button>
      )}
      {open && (
        <MessageDialog recipients={[recipient]} initialKind="confirmed" {...common} onOpenChange={setOpen} />
      )}
    </>
  );
}

/// Réservation sans table (typiquement une demande en ligne) : l'installer = choisir sa table.
export function ChooseTableButton({ reservationId }: { reservationId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Armchair size={14} aria-hidden="true" />
        Choisir une table
      </Button>
      {open && <MoveReservationDialog reservationId={reservationId} onOpenChange={setOpen} />}
    </>
  );
}
