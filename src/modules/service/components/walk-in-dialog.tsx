"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { createWalkIn } from "@/modules/reservations/server/actions";

export function WalkInDialog({
  open,
  onOpenChange,
  tableId,
  tableCapacity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  tableCapacity: number;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState(Math.min(tableCapacity, 2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overCapacity = partySize > tableCapacity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Client sans réservation</DialogTitle>
        <DialogDescription>Installe directement un walk-in sur cette table.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!customerName.trim()) return;
            setPending(true);
            setError(null);
            try {
              await createWalkIn({
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim() || undefined,
                partySize,
                tableIds: [tableId],
                allowOverCapacity: overCapacity,
              });
              toast("Client installé");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="walkin-name" className="text-sm font-semibold">
              Nom
            </label>
            <input
              id="walkin-name"
              autoFocus
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ex: Famille Dupont"
              className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="walkin-phone" className="text-sm font-semibold">
                Téléphone (optionnel)
              </label>
              <input
                id="walkin-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="walkin-size" className="text-sm font-semibold">
                Personnes
              </label>
              <input
                id="walkin-size"
                type="number"
                min={1}
                max={60}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
              />
            </div>
          </div>

          {overCapacity && (
            <p className="rounded-lg bg-important-soft px-3 py-2 text-sm text-important" role="status">
              Conflit de capacité : cette table a {tableCapacity} place{tableCapacity > 1 ? "s" : ""} pour {partySize} personnes.
              Tu peux l&apos;installer quand même.
            </p>
          )}

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending || !customerName.trim()}>
            {pending ? "Installation…" : overCapacity ? "Installer quand même" : "Installer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
