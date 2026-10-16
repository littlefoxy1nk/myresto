"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast-bus";
import { deleteCustomer } from "@/modules/customers/server/actions";

/// Supprimer la fiche d'un client (à sa demande) : ses coordonnées disparaissent de l'appli.
export function DeleteCustomerButton({ customerId, name }: { customerId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="border-urgent/40 text-urgent hover:bg-urgent-soft" onClick={() => setOpen(true)}>
        <Trash2 size={14} aria-hidden="true" />
        Supprimer ce client
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Supprimer ${name} ?`}
        description="Sa fiche et ses coordonnées sont effacées définitivement. Ses anciennes réservations restent, sans son nom ni ses coordonnées."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          try {
            await deleteCustomer(customerId);
            toast("Client supprimé");
            router.push("/clients");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Impossible de supprimer.", "error");
          }
        }}
      />
    </>
  );
}
