"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { STOCK_MOVEMENT_TYPES } from "@/modules/stock/types";

function revalidateStockPaths() {
  revalidatePath("/stock");
  revalidatePath("/aujourdhui");
}

const CreateProductSchema = z.object({
  name: z.string().min(1, "Le nom est requis."),
  category: z.string().min(1, "La catégorie est requise."),
  unit: z.string().min(1, "L'unité est requise."),
  currentStock: z.coerce.number().min(0),
  reorderThreshold: z.coerce.number().min(0),
  avgDailyUsage: z.coerce.number().min(0),
  unitCostCents: z.coerce.number().int().min(0),
  supplierId: z.string().optional(),
});

export async function createProduct(input: z.infer<typeof CreateProductSchema>) {
  const ctx = await requirePermission("inventory.manage");
  const data = CreateProductSchema.parse(input);

  if (data.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, establishmentId: ctx.establishment.id } });
    if (!supplier) throw new Error("Fournisseur introuvable.");
  }

  await prisma.product.create({
    data: {
      establishmentId: ctx.establishment.id,
      name: data.name,
      category: data.category,
      unit: data.unit,
      currentStock: data.currentStock,
      reorderThreshold: data.reorderThreshold,
      avgDailyUsage: data.avgDailyUsage,
      unitCostCents: data.unitCostCents,
      supplierId: data.supplierId || null,
    },
  });

  revalidateStockPaths();
}

const MovementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.coerce.number().min(0, "La quantité doit être positive ou nulle."),
  note: z.string().optional(),
});

/// "in" ajoute, "out" retire (jamais sous 0 — un stock physique ne peut pas être
/// négatif), "inventory_adjustment" fixe le stock à la valeur comptée (correction
/// d'inventaire), la quantité représentant alors le nouveau niveau, pas un delta.
export async function recordStockMovement(input: z.infer<typeof MovementSchema>) {
  const ctx = await requirePermission("inventory.manage");
  const data = MovementSchema.parse(input);

  const product = await prisma.product.findFirst({ where: { id: data.productId, establishmentId: ctx.establishment.id } });
  if (!product) throw new Error("Produit introuvable.");

  const newStock =
    data.type === "in"
      ? product.currentStock + data.quantity
      : data.type === "out"
        ? Math.max(0, product.currentStock - data.quantity)
        : data.quantity;

  await prisma.$transaction([
    prisma.product.update({ where: { id: data.productId }, data: { currentStock: newStock } }),
    prisma.stockMovement.create({
      data: {
        establishmentId: ctx.establishment.id,
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        note: data.note || null,
      },
    }),
  ]);

  revalidateStockPaths();
}
