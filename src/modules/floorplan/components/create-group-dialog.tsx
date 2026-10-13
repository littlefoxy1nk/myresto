"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CreateGroupDialog({
  open,
  onOpenChange,
  tableLabels,
  suggestedCapacity,
  dayLabel,
  allowPermanent,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableLabels: string[];
  suggestedCapacity: number;
  /// Le jour concerné, en toutes lettres ("aujourd'hui", "vendredi 9 octobre").
  dayLabel: string;
  /// Faux sur l'aperçu d'un autre jour : la fusion n'y vaut que pour ce jour.
  allowPermanent: boolean;
  onCreate: (combinedCapacity: number, label: string, permanent: boolean) => Promise<void>;
}) {
  const [capacity, setCapacity] = useState(suggestedCapacity);
  const [label, setLabel] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => setCapacity(suggestedCapacity), [suggestedCapacity]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Fusionner {tableLabels.join(" + ")}</DialogTitle>
        <DialogDescription>
          Ces tables seront présentées comme une seule unité sur le plan {permanent ? "tant que le groupe est actif" : `${dayLabel} uniquement — les autres jours restent inchangés`}.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            await onCreate(capacity, label.trim(), allowPermanent && permanent);
            setPending(false);
            onOpenChange(false);
          }}
        >
          {allowPermanent && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Durée de la fusion">
              {[
                { value: false, title: `Seulement ${dayLabel}`, hint: "Les autres jours restent inchangés" },
                { value: true, title: "Tous les jours", hint: "Fusion permanente" },
              ].map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  role="radio"
                  aria-checked={permanent === o.value}
                  onClick={() => setPermanent(o.value)}
                  className={`rounded-xl border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    permanent === o.value ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="block text-sm font-medium">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          )}
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
