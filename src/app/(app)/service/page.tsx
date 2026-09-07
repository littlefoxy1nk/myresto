import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getServiceSnapshot } from "@/modules/service/server/queries";
import { getZoneAssignments } from "@/modules/staff/server/assignments";
import { ServiceApp } from "@/modules/service/components/service-app";

export default async function ServicePage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("service.run")) redirect("/aujourdhui");

  const [snapshot, assignments] = await Promise.all([
    getServiceSnapshot(ctx.establishment.id),
    getZoneAssignments(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <ServiceApp snapshot={snapshot} assignments={assignments} />
    </div>
  );
}
