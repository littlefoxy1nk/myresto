"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { createProduct } from "@/modules/stock/server/actions";
import type { SupplierOption } from "@/modules/stock/types";

export function ProductFormDialog({
  open,
  onOpenChange,
  suppliers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("kg");
  const [currentStock, setCurrentStock] = useState(0);
  const [reorderThreshold, setReorderThreshold] = useState(0);
  const [avgDailyUsage, setAvgDailyUsage] = useState(0);
  const [unitCostCents, setUnitCostCents] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Nouveau produit</DialogTitle>
        <DialogDescription>Ajoutez un produit suivi en stock.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || !category.trim() || !unit.trim()) return;
            setPending(true);
            setError(null);
            try {
              await createProduct({
                name: name.trim(),
                category: category.trim(),
                unit: unit.trim(),
                currentStock,
                reorderThreshold,
                avgDailyUsage,
                unitCostCents,
                supplierId: supplierId || undefined,
              });
              toast("Produit ajouté");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="product-name" className="text-sm font-medium">
                Nom
              </label>
              <input
                id="product-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Filet de bœuf"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-category" className="text-sm font-medium">
                Catégorie
              </label>
              <input
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="ex: Viande"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="product-unit" className="text-sm font-medium">
                Unité
              </label>
              <input
                id="product-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg, L, pièce…"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-stock" className="text-sm font-medium">
                Stock initial
              </label>
              <input
                id="product-stock"
                type="number"
                min={0}
                step="any"
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-threshold" className="text-sm font-medium">
                Seuil d&apos;alerte
              </label>
              <input
                id="product-threshold"
                type="number"
                min={0}
                step="any"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="product-usage" className="text-sm font-medium">
                Conso. moy./jour
              </label>
              <input
                id="product-usage"
                type="number"
                min={0}
                step="any"
                value={avgDailyUsage}
                onChange={(e) => setAvgDailyUsage(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-cost" className="text-sm font-medium">
                Coût unitaire (€)
              </label>
              <input
                id="product-cost"
                type="number"
                min={0}
                step="0.01"
                value={unitCostCents / 100}
                onChange={(e) => setUnitCostCents(Math.round(Number(e.target.value) * 100))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-supplier" className="text-sm font-medium">
                Fournisseur
              </label>
              <select
                id="product-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">Aucun</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending || !name.trim() || !category.trim() || !unit.trim()}>
            {pending ? "Création…" : "Créer le produit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
