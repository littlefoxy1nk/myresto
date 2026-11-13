"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { updateReservationStatus } from "@/modules/reservations/server/actions";
import { MessageDialog, loadTemplate, type MessageRecipient } from "@/modules/reservations/components/message-dialog";
import { MoveReservationDialog } from "@/modules/reservations/components/move-reservation-dialog";
import { confirmationFeedback } from "@/modules/reservations/confirm-feedback";
import { buildMessageLinks, renderMessage, type MessageKind } from "@/modules/messaging/templates";

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

/// "Confirmer" : passe la réservation en confirmée et prévient le client tout de suite, sans qu'on puisse l'oublier.
///  • Client avec un email : l'email part tout seul (voir updateReservationStatus).
///  • Client sans email mais avec un numéro : l'appli Messages du téléphone s'ouvre aussitôt, sur le bon contact, avec le texte
///    « réservation confirmée » déjà écrit — il ne reste qu'à appuyer sur Envoyer. L'ouverture se fait dans le geste du clic
///    (un navigateur refuse d'ouvrir une autre appli plus tard, une fois la réponse du serveur arrivée).
///  • Si rien de tout cela n'est possible, le message à préparer à la main s'affiche.
export function ConfirmAndNotifyButton({
  recipient,
  status,
  ...common
}: Common & { recipient: MessageRecipient; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const leftForMessages = useRef(false);

  // Au retour de l'appli Messages, la page a pu rater la réponse du serveur : on la recharge pour qu'elle montre le bon statut.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && leftForMessages.current) {
        leftForMessages.current = false;
        router.refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  function confirmReservation() {
    const messagesLink =
      recipient.phone && !recipient.email
        ? buildMessageLinks({
            phone: recipient.phone,
            email: null,
            subject: "",
            text: renderMessage(loadTemplate("confirmed"), {
              nom: recipient.customerName,
              personnes: recipient.partySize,
              heure: recipient.time,
              date: common.dateLabel,
              restaurant: common.restaurantName,
            }),
          }).sms
        : null;

    startTransition(async () => {
      try {
        const { emailed, emailOutcome } = await updateReservationStatus(recipient.id, "confirmed");
        const feedback = confirmationFeedback(emailOutcome, { phone: !!recipient.phone, email: !!recipient.email }, !!messagesLink);
        toast(feedback.message, feedback.tone === "warning" ? "info" : "success");
        // Le message à préparer à la main n'est proposé que si le client n'a été prévenu ni par email ni dans Messages.
        if (!messagesLink && !emailed && (recipient.phone || recipient.email)) setOpen(true);
      } catch {
        toast("Impossible d'enregistrer les modifications", "error");
      }
    });
    // Après avoir lancé la confirmation (la requête part tout de suite), et dans le même geste : on ouvre Messages.
    if (messagesLink) {
      leftForMessages.current = true;
      window.location.href = messagesLink;
    }
  }

  return (
    <>
      {status === "new" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={confirmReservation}>
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
