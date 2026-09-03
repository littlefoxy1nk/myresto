"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateReservationStatus } from "@/modules/reservations/server/actions";
import { toast } from "@/lib/toast-bus";

const SUCCESS_MESSAGE: Record<string, string> = {
  confirmed: "Réservation confirmée",
  seated: "Table installée",
};

export function ReservationActionButton({
  reservationId,
  targetStatus,
  label,
  className,
}: {
  reservationId: string;
  targetStatus: "confirmed" | "seated";
  label: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          try {
            await updateReservationStatus(reservationId, targetStatus);
            toast(SUCCESS_MESSAGE[targetStatus] ?? "Mise à jour effectuée");
          } catch {
            toast("Impossible d'enregistrer les modifications", "error");
          }
        });
      }}
    >
      {pending ? "…" : label}
    </Button>
  );
}
