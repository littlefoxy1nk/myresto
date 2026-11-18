"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { saveReservationAsCustomer } from "@/modules/customers/server/actions";

/// Ajoute la personne de cette réservation à la base clients — rien n'y entre tout seul, c'est le restaurateur qui choisit.
export function SaveCustomerButton({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const { created } = await saveReservationAsCustomer(reservationId);
            toast(created ? "Client enregistré" : "Déjà enregistré : réservation rattachée à sa fiche");
            router.refresh();
          } catch (err) {
            toast(err instanceof Error ? err.message : "Impossible d'enregistrer ce client.", "error");
          }
        })
      }
    >
      <UserPlus size={14} aria-hidden="true" />
      {pending ? "…" : "Enregistrer le client"}
    </Button>
  );
}
