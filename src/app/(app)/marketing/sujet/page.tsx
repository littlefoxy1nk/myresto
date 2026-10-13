import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getEditorialLines } from "@/modules/marketing/server/queries";
import { SubjectWorkshop } from "@/modules/marketing/components/subject-workshop";

export default async function SubjectPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("marketing.publish")) redirect("/marketing/en-attente");
  const lines = await getEditorialLines();
  return <SubjectWorkshop lines={lines} />;
}
