"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { recordStockMovement } from "@/modules/stock/server/actions";
import type { StockMovementType } from "@/modules/stock/types";

const TYPE_LABEL: Record<StockMovementType, string> = {
  in: "Livraison reçue",
  out: "Sortie / perte",
  inventory_adjustment: "Correction d'inventaire",
};

export function StockMovementDialog({
  open,
  onOpenChange,
  productId,
  productName,
  unit,
  currentStock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  unit: string;
  currentStock: number;
}) {
  const [type, setType] = useState<StockMovementType>("in");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{productName}</DialogTitle>
        <DialogDescription>
          Stock actuel : {currentStock} {unit}
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            try {
              await recordStockMovement({ productId, type, quantity, note: note || undefined });
              toast("Mouvement enregistré");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_LABEL) as StockMovementType[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-xl border px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  type === t ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="movement-quantity" className="text-sm font-medium">
              {type === "inventory_adjustment" ? `Nouveau stock (${unit})` : `Quantité (${unit})`}
            </label>
            <input
              id="movement-quantity"
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="movement-note" className="text-sm font-medium">
              Note (optionnel)
            </label>
            <input
              id="movement-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex: livraison Boucherie Centrale"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
