import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getServiceSnapshot } from "@/modules/service/server/queries";
import { ServiceApp } from "@/modules/service/components/service-app";

export default async function ServicePage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("service.run")) redirect("/aujourdhui");

  const snapshot = await getServiceSnapshot(ctx.establishment.id);

  return (
    <div className="mx-auto max-w-3xl">
      <ServiceApp snapshot={snapshot} />
    </div>
  );
}
