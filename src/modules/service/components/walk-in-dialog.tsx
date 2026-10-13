"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { createWalkIn } from "@/modules/reservations/server/actions";

const DURATIONS = [60, 90, 120, 180, 240];

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

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
  const [durationMinutes, setDurationMinutes] = useState(90);
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
                durationMinutes,
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
            <label htmlFor="walkin-name" className="text-sm font-medium">
              Nom
            </label>
            <input
              id="walkin-name"
              autoFocus
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ex: Famille Dupont"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="walkin-phone" className="text-sm font-medium">
                Téléphone (optionnel)
              </label>
              <input
                id="walkin-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="walkin-size" className="text-sm font-medium">
                Personnes
              </label>
              <input
                id="walkin-size"
                type="number"
                min={1}
                max={60}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Durée sur la table</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Durée sur la table">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={durationMinutes === d}
                  onClick={() => setDurationMinutes(d)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    durationMinutes === d ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  )}
                >
                  {formatDuration(d)}
                </button>
              ))}
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
