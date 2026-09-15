"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { recordDailyClosing } from "@/modules/finance/server/actions";

export function ClosingDialog({
  open,
  onOpenChange,
  date,
  dateLabel,
  initialRevenueCents,
  initialCovers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  dateLabel: string;
  initialRevenueCents: number | null;
  initialCovers: number | null;
}) {
  const [revenue, setRevenue] = useState(initialRevenueCents != null ? String(initialRevenueCents / 100) : "");
  const [covers, setCovers] = useState(initialCovers != null ? String(initialCovers) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revenueValue = Number(revenue.replace(",", "."));
  const coversValue = Number(covers);
  const valid = revenue !== "" && covers !== "" && Number.isFinite(revenueValue) && revenueValue >= 0 && Number.isInteger(coversValue) && coversValue >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Clôture — {dateLabel}</DialogTitle>
        <DialogDescription>
          Saisissez le CA réel et le nombre de couverts de la journée. Cette valeur remplace toute estimation.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setPending(true);
            setError(null);
            try {
              await recordDailyClosing({ date, revenueCents: Math.round(revenueValue * 100), covers: coversValue });
              toast("Clôture enregistrée");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="closing-revenue" className="text-sm font-medium">
              CA du jour (€)
            </label>
            <input
              id="closing-revenue"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="closing-covers" className="text-sm font-medium">
              Couverts
            </label>
            <input
              id="closing-covers"
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={covers}
              onChange={(e) => setCovers(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending || !valid}>
            {pending ? "Enregistrement…" : "Enregistrer la clôture"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
