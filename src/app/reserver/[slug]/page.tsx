import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBookingInfo } from "@/modules/booking/server/queries";
import { BookingForm } from "@/modules/booking/components/booking-form";

export const metadata: Metadata = { title: "Réserver une table", robots: { index: false } };

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await getPublicBookingInfo(slug);
  if (!info) notFound();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{info.name}</h1>
        {info.city && <p className="mt-1 text-sm text-muted-foreground">{info.city}</p>}
        <p className="mt-3 text-sm text-muted-foreground">
          Envoie ta demande de réservation : le restaurant te confirme par message.
        </p>
      </header>
      <BookingForm slug={slug} restaurantName={info.name} services={info.services} />
    </main>
  );
}
