import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { NewReservationFlow } from "./new-reservation-flow";

export default async function NouvelleReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string; zoneId?: string; date?: string; time?: string }>;
}) {
  const ctx = await getCurrentContext();
  if (!ctx.can("reservations.edit")) redirect("/reservations");

  const { tableId, zoneId, date, time } = await searchParams;
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const initialTime = time && /^\d{2}:\d{2}$/.test(time) ? time : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <NewReservationFlow
        preselectedTableId={tableId}
        preselectedZoneId={zoneId}
        initialDate={initialDate}
        initialTime={initialTime}
      />
    </div>
  );
}
