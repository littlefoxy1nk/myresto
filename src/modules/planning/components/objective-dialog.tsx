"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { setServiceObjective } from "@/modules/planning/server/actions";

export function ObjectiveDialog({
  open,
  onOpenChange,
  membershipId,
  memberName,
  currentTarget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  memberName: string;
  currentTarget: number | null;
}) {
  const [count, setCount] = useState(currentTarget ?? 5);
  const [pending, setPending] = useState(false);

  async function save(value: number | null) {
    setPending(true);
    try {
      await setServiceObjective(membershipId, value);
      toast(value == null ? "Objectif retiré" : "Objectif enregistré");
      onOpenChange(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Objectif de services — {memberName}</DialogTitle>
        <DialogDescription>
          Nombre de services visé cette semaine. MYRESTO indiquera si les contraintes connues (congés,
          disponibilités) permettent de l&apos;atteindre.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(count);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="objective-count" className="text-sm font-medium">
              Services visés
            </label>
            <input
              id="objective-count"
              type="number"
              min={1}
              max={21}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {currentTarget != null && (
              <Button type="button" variant="ghost" className="text-urgent hover:bg-urgent-soft" onClick={() => save(null)} disabled={pending}>
                Retirer l&apos;objectif
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={pending || count < 1}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
