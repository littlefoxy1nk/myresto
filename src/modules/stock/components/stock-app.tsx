"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { ProductFormDialog } from "@/modules/stock/components/product-form-dialog";
import { StockMovementDialog } from "@/modules/stock/components/stock-movement-dialog";
import type { ProductItem, StockOverview } from "@/modules/stock/types";

const STATUS_LABEL: Record<ProductItem["status"], string> = { ok: "OK", low: "À surveiller", critical: "Critique" };
const STATUS_VARIANT: Record<ProductItem["status"], "good" | "watch" | "urgent"> = { ok: "good", low: "watch", critical: "urgent" };

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  in: "Livraison",
  out: "Sortie",
  inventory_adjustment: "Correction",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function StockApp({ overview }: { overview: StockOverview }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [movementFor, setMovementFor] = useState<ProductItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview.products.length} produit{overview.products.length > 1 ? "s" : ""} ·{" "}
            {formatCents(overview.totalStockValueCents)} de valeur
            {overview.criticalCount + overview.lowCount > 0 &&
              ` · ${overview.criticalCount + overview.lowCount} à surveiller`}
          </p>
        </div>
        {overview.canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Produit
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {overview.products.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.category}
                {p.supplierName && ` · ${p.supplierName}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:w-auto">
              <span className="text-sm tabular-nums">
                {p.currentStock} {p.unit}
              </span>
              <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
              {p.daysLeft != null && p.status !== "ok" && (
                <span className="text-xs text-muted-foreground">
                  ≈ {p.daysLeft} jour{p.daysLeft > 1 ? "s" : ""}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{formatCents(p.stockValueCents)}</span>
            </div>
            {overview.canManage && (
              <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => setMovementFor(p)}>
                Mouvement
              </Button>
            )}
          </Card>
        ))}
        {overview.products.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun produit suivi pour le moment.</Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Derniers mouvements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0">
          {overview.recentMovements.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm odd:bg-muted/50">
              <span>
                {MOVEMENT_TYPE_LABEL[m.type] ?? m.type} · {m.productName}
                {m.note && <span className="text-muted-foreground"> — {m.note}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
            </div>
          ))}
          {overview.recentMovements.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun mouvement enregistré pour le moment.</p>
          )}
        </CardContent>
      </Card>

      {overview.canManage && <ProductFormDialog open={createOpen} onOpenChange={setCreateOpen} suppliers={overview.suppliers} />}
      {movementFor && (
        <StockMovementDialog
          open
          onOpenChange={(o) => !o && setMovementFor(null)}
          productId={movementFor.id}
          productName={movementFor.name}
          unit={movementFor.unit}
          currentStock={movementFor.currentStock}
        />
      )}
    </div>
  );
}
