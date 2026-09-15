import { prisma } from "@/lib/prisma";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { computeDaysLeft, computeStockStatus } from "@/modules/stock/compute";
import type { ProductItem, StockMovementItem, StockOverview } from "@/modules/stock/types";

/// Vue d'ensemble du stock — uniquement ce que les données permettent d'établir
/// honnêtement : niveaux, valeur, mouvements. Pas de consommation dérivée des ventes
/// (aucun lien recette/commande n'existe dans le produit aujourd'hui), pas de coût
/// matière par couvert, pas de marge produit — voir le rapport de mission pour le détail
/// de ce qui est volontairement hors scope.
export async function getStockOverview(establishmentId: string): Promise<StockOverview> {
  const ctx = await getCurrentContext();
  if (!ctx.can("inventory.view")) throw new ForbiddenError("inventory.view");

  const [products, suppliers, movements] = await Promise.all([
    prisma.product.findMany({ where: { establishmentId }, include: { supplier: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { establishmentId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: { establishmentId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const productItems: ProductItem[] = products.map((p) => {
    const daysLeft = computeDaysLeft(p.currentStock, p.avgDailyUsage);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      currentStock: p.currentStock,
      reorderThreshold: p.reorderThreshold,
      avgDailyUsage: p.avgDailyUsage,
      unitCostCents: p.unitCostCents,
      supplierName: p.supplier?.name ?? null,
      daysLeft,
      status: computeStockStatus(p.currentStock, p.reorderThreshold, daysLeft),
      stockValueCents: Math.round(p.currentStock * p.unitCostCents),
    };
  });

  const recentMovements: StockMovementItem[] = movements.map((m) => ({
    id: m.id,
    productId: m.productId,
    productName: m.product.name,
    type: m.type as StockMovementItem["type"],
    quantity: m.quantity,
    note: m.note,
    createdAt: m.createdAt.toISOString(),
  }));

  return {
    products: productItems,
    suppliers,
    totalStockValueCents: productItems.reduce((s, p) => s + p.stockValueCents, 0),
    lowCount: productItems.filter((p) => p.status === "low").length,
    criticalCount: productItems.filter((p) => p.status === "critical").length,
    recentMovements,
    canManage: ctx.can("inventory.manage"),
  };
}
