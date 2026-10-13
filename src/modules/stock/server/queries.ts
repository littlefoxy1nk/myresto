import { prisma } from "@/lib/prisma";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";

export type ShoppingListView = {
  id: string;
  name: string;
  items: { id: string; label: string; checked: boolean }[];
};

export async function getShoppingLists(establishmentId: string): Promise<ShoppingListView[]> {
  const ctx = await getCurrentContext();
  if (!ctx.can("inventory.view")) throw new ForbiddenError("inventory.view");

  const lists = await prisma.shoppingList.findMany({
    where: { establishmentId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    items: l.items.map((i) => ({ id: i.id, label: i.label, checked: i.checked })),
  }));
}
