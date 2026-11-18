"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-bus";
import { deleteAllCustomers } from "@/modules/customers/server/actions";

/// « Supprimer tous les clients » : vide la base clients de l'établissement. Les réservations ne sont pas touchées.
export function DeleteAllCustomersButton({ total, subscribers }: { total: number; subscribers: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [keepNewsletter, setKeepNewsletter] = useState(true);
  const deleting = keepNewsletter ? total - subscribers : total;

  return (
    <>
      <Button variant="outline" size="sm" className="border-urgent/40 text-urgent hover:bg-urgent-soft" onClick={() => setOpen(true)}>
        <Trash2 size={14} aria-hidden="true" />
        Supprimer tous les clients
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Supprimer tous les clients ?</DialogTitle>
          <DialogDescription>
            Les fiches sont effacées définitivement : coordonnées, préférences, allergies, notes. Les réservations ne changent pas : leur nom, leur
            téléphone et le plan de salle restent comme ils sont.
          </DialogDescription>

          {subscribers > 0 && (
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-3 text-sm">
              <input type="checkbox" checked={keepNewsletter} onChange={(e) => setKeepNewsletter(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">Garder les {subscribers} inscrit{subscribers > 1 ? "s" : ""} à la newsletter</span>
                <span className="block text-xs text-muted-foreground">
                  Leur accord est enregistré et le lien de désinscription de leurs mails en dépend. Décoche pour les supprimer aussi.
                </span>
              </span>
            </label>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              className="bg-urgent hover:opacity-90"
              disabled={pending || deleting === 0}
              onClick={async () => {
                setPending(true);
                try {
                  const { deleted, keptSubscribers } = await deleteAllCustomers(keepNewsletter);
                  toast(`${deleted} client${deleted > 1 ? "s supprimés" : " supprimé"}${keptSubscribers > 0 ? ` · ${keptSubscribers} inscrit${keptSubscribers > 1 ? "s" : ""} à la newsletter gardé${keptSubscribers > 1 ? "s" : ""}` : ""}`);
                  setOpen(false);
                  router.refresh();
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Impossible de supprimer.", "error");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Suppression…" : `Supprimer ${deleting} client${deleting > 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
