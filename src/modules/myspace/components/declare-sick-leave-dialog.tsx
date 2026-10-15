"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { toDateKey } from "@/lib/utils";
import { declareSickLeave } from "@/modules/myspace/server/actions";

function today() {
  return toDateKey(new Date());
}

/// Par défaut "aujourd'hui seulement" — le cas le plus fréquent (on se déclare
/// malade le jour même) — avec la possibilité d'étendre la fin si l'arrêt dure
/// plusieurs jours. Contrairement à un congé, pas de date de début future : voir
/// declareSickLeave côté serveur.
export function DeclareSickLeaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = today();
  const valid = endDate >= startDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Signaler une absence maladie</DialogTitle>
        <DialogDescription>
          Votre manager sera prévenu immédiatement. Un certificat médical pourra être ajouté ensuite, si vous en avez un.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setPending(true);
            setError(null);
            try {
              await declareSickLeave({ startDate, endDate, reason: reason || undefined });
              toast("Absence signalée");
              onOpenChange(false);
              setEndDate(today());
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
              <label htmlFor="sick-start" className="text-sm font-medium">
                Du
              </label>
              <input
                id="sick-start"
                type="date"
                value={startDate}
                disabled
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sick-end" className="text-sm font-medium">
                Au
              </label>
              <input
                id="sick-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sick-reason" className="text-sm font-medium">
              Précision (optionnel)
            </label>
            <input
              id="sick-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
            />
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending || !valid}>
            {pending ? "Envoi…" : "Signaler"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
