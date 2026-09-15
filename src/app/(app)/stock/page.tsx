import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getStockOverview } from "@/modules/stock/server/queries";
import { StockApp } from "@/modules/stock/components/stock-app";

export default async function StockPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("inventory.view")) redirect("/aujourdhui");

  const overview = await getStockOverview(ctx.establishment.id);

  return (
    <div className="mx-auto max-w-3xl">
      <StockApp overview={overview} />
    </div>
  );
}
