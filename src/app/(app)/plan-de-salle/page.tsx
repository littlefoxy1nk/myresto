import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getFloorPlan } from "@/modules/floorplan/server/queries";
import { FloorPlanApp } from "@/modules/floorplan/components/floor-plan-app";

export default async function PlanDeSallePage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("floorplan.view")) redirect("/aujourdhui");

  const zones = await getFloorPlan(ctx.establishment.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan de salle</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ctx.establishment.name}</p>
      </div>

      <FloorPlanApp
        zones={zones}
        canEdit={ctx.can("floorplan.edit")}
        canCreateReservation={ctx.can("reservations.edit")}
      />
    </div>
  );
}
