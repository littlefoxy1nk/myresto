import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { NewReservationFlow } from "./new-reservation-flow";

export default async function NouvelleReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string; zoneId?: string }>;
}) {
  const ctx = await getCurrentContext();
  if (!ctx.can("reservations.edit")) redirect("/reservations");

  const { tableId, zoneId } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <NewReservationFlow preselectedTableId={tableId} preselectedZoneId={zoneId} />
    </div>
  );
}
