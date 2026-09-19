"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-bus";
import { removeEmployee } from "@/modules/staff/server/actions";

export function RemoveEmployeeButton({ membershipId, name }: { membershipId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await removeEmployee(membershipId);
      toast(`${name} a été retiré·e de l'équipe.`);
      router.push("/equipe");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="border-urgent text-urgent hover:bg-urgent-soft" onClick={() => setOpen(true)}>
        <UserX size={14} aria-hidden="true" />
        Supprimer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Supprimer {name} de l&apos;équipe ?</DialogTitle>
          <DialogDescription>
            Tous ses accès sont coupés immédiatement — identifiant, mot de passe ou code, connexion à
            l&apos;application — et {name} disparaît de l&apos;équipe active. Son historique (plannings passés,
            congés, documents) reste conservé pour vos rapports.
          </DialogDescription>
          {error && <p className="mt-3 text-sm text-urgent">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button
              className="bg-urgent text-white hover:opacity-90"
              disabled={pending}
              onClick={confirm}
            >
              {pending ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
