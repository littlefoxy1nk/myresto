"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { requestTimeOff } from "@/modules/myspace/server/actions";

export function RequestTimeOffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = !!startDate && !!endDate && startDate <= endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Demander un congé</DialogTitle>
        <DialogDescription>
          Votre demande sera envoyée à la personne qui valide les congés. Elle reste "en attente" jusqu'à sa décision.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setPending(true);
            setError(null);
            try {
              await requestTimeOff({ startDate, endDate, reason: reason || undefined });
              toast("Demande envoyée");
              onOpenChange(false);
              setStartDate("");
              setEndDate("");
              setReason("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="timeoff-start" className="text-sm font-medium">
                Du
              </label>
              <input
                id="timeoff-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="timeoff-end" className="text-sm font-medium">
                Au
              </label>
              <input
                id="timeoff-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="timeoff-reason" className="text-sm font-medium">
              Motif (optionnel)
            </label>
            <input
              id="timeoff-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex: rendez-vous médical"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending || !valid}>
            {pending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
