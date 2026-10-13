import { getCurrentContext } from "@/lib/current-context";
import { getEditorialLines } from "@/modules/marketing/server/queries";
import { EditorialLinesApp } from "@/modules/marketing/components/editorial-lines-app";

export default async function EditorialLinePage() {
  const ctx = await getCurrentContext();
  const lines = await getEditorialLines();
  return <EditorialLinesApp lines={lines} canManage={ctx.can("marketing.publish")} />;
}
