import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getShoppingLists } from "@/modules/stock/server/queries";
import { ShoppingApp } from "@/modules/stock/components/shopping-app";

export default async function StockPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("inventory.view")) redirect("/aujourdhui");

  const lists = await getShoppingLists(ctx.establishment.id);

  return (
    <div className="mx-auto max-w-4xl">
      <ShoppingApp lists={lists} canEdit={ctx.can("inventory.manage")} />
    </div>
  );
}
