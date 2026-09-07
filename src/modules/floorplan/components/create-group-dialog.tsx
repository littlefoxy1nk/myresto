"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CreateGroupDialog({
  open,
  onOpenChange,
  tableLabels,
  suggestedCapacity,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableLabels: string[];
  suggestedCapacity: number;
  onCreate: (combinedCapacity: number, label: string) => Promise<void>;
}) {
  const [capacity, setCapacity] = useState(suggestedCapacity);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => setCapacity(suggestedCapacity), [suggestedCapacity]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Fusionner {tableLabels.join(" + ")}</DialogTitle>
        <DialogDescription>
          Ces tables seront présentées comme une seule unité sur le plan tant que le groupe est actif.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            await onCreate(capacity, label.trim());
            setPending(false);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="group-capacity" className="text-sm font-medium">
              Capacité combinée
            </label>
            <input
              id="group-capacity"
              type="number"
              min={1}
              max={60}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <p className="text-xs text-muted-foreground">
              Par défaut, la somme des tables sélectionnées — ajustez si deux petites tables collées n&apos;accueillent pas
              exactement ce total.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="group-label" className="text-sm font-medium">
              Nom (optionnel)
            </label>
            <input
              id="group-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tableLabels.join(" + ")}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Fusion…" : "Fusionner"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
