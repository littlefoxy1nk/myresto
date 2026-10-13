"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { MAX_ITEM_LENGTH, parseItemLines } from "@/modules/stock/shopping";

const NameSchema = z.string().trim().min(1, "Donne un nom à la rubrique.").max(60, "Nom trop long (60 caractères maximum).");

function revalidate() {
  revalidatePath("/stock");
}

async function ownedList(listId: string, establishmentId: string) {
  const list = await prisma.shoppingList.findFirst({ where: { id: listId, establishmentId } });
  if (!list) throw new Error("Rubrique introuvable.");
  return list;
}

async function ownedItem(itemId: string, establishmentId: string) {
  const item = await prisma.shoppingItem.findFirst({ where: { id: itemId, list: { establishmentId } } });
  if (!item) throw new Error("Article introuvable.");
  return item;
}

export async function createShoppingList(name: string) {
  const ctx = await requirePermission("inventory.manage");
  const parsed = NameSchema.parse(name);
  const last = await prisma.shoppingList.findFirst({
    where: { establishmentId: ctx.establishment.id },
    orderBy: { sortOrder: "desc" },
  });
  await prisma.shoppingList.create({
    data: { establishmentId: ctx.establishment.id, name: parsed, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidate();
}

export async function renameShoppingList(listId: string, name: string) {
  const ctx = await requirePermission("inventory.manage");
  const parsed = NameSchema.parse(name);
  await ownedList(listId, ctx.establishment.id);
  await prisma.shoppingList.update({ where: { id: listId }, data: { name: parsed } });
  revalidate();
}

export async function deleteShoppingList(listId: string) {
  const ctx = await requirePermission("inventory.manage");
  await ownedList(listId, ctx.establishment.id);
  await prisma.shoppingList.delete({ where: { id: listId } });
  revalidate();
}

/// Ajoute un ou plusieurs articles (une ligne = un article, on peut coller une liste entière).
export async function addShoppingItems(listId: string, text: string) {
  const ctx = await requirePermission("inventory.manage");
  await ownedList(listId, ctx.establishment.id);
  const labels = parseItemLines(text);
  if (labels.length === 0) return;
  await prisma.shoppingItem.createMany({ data: labels.map((label) => ({ listId, label })) });
  revalidate();
}

export async function updateShoppingItem(itemId: string, label: string) {
  const ctx = await requirePermission("inventory.manage");
  await ownedItem(itemId, ctx.establishment.id);
  const clean = z.string().trim().min(1, "L'article ne peut pas être vide.").max(MAX_ITEM_LENGTH).parse(label);
  await prisma.shoppingItem.update({ where: { id: itemId }, data: { label: clean } });
  revalidate();
}

export async function setShoppingItemChecked(itemId: string, checked: boolean) {
  const ctx = await requirePermission("inventory.manage");
  await ownedItem(itemId, ctx.establishment.id);
  await prisma.shoppingItem.update({ where: { id: itemId }, data: { checked } });
  revalidate();
}

export async function deleteShoppingItem(itemId: string) {
  const ctx = await requirePermission("inventory.manage");
  await ownedItem(itemId, ctx.establishment.id);
  await prisma.shoppingItem.delete({ where: { id: itemId } });
  revalidate();
}

/// "Supprimer les cochés" (on a fini les courses) ou "Tout décocher" (on garde la liste pour la prochaine fois).
export async function clearCheckedItems(listId: string, mode: "delete" | "uncheck") {
  const ctx = await requirePermission("inventory.manage");
  await ownedList(listId, ctx.establishment.id);
  if (mode === "delete") await prisma.shoppingItem.deleteMany({ where: { listId, checked: true } });
  else await prisma.shoppingItem.updateMany({ where: { listId, checked: true }, data: { checked: false } });
  revalidate();
}
