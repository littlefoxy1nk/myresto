import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getPublicBookingInfo } from "@/modules/booking/server/queries";
import { BookingForm } from "@/modules/booking/components/booking-form";
import { BrandMark } from "@/components/nav/brand-mark";

export const metadata: Metadata = { title: "Réserver une table", robots: { index: false } };

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await getPublicBookingInfo(slug);
  if (!info) notFound();

  return (
    <div className="min-h-screen">
      {/* Bannière aux couleurs de l'appli : le restaurant en vedette, le formulaire qui chevauche en dessous. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#ee7d4b] via-[#c0451f] to-[#9f1f4d] pb-28 pt-12 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#14100d]/25 blur-3xl" />
        <header className="page-in relative mx-auto max-w-lg px-4 text-center">
          <BrandMark name={info.name} className="mx-auto mb-5 h-16 w-16 text-3xl ring-4 ring-white/30" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Réservation en ligne</p>
          <h1 className="mt-1.5 text-4xl font-bold tracking-tight">{info.name}</h1>
          {info.city && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-white/80">
              <MapPin size={14} aria-hidden="true" />
              {info.city}
            </p>
          )}
        </header>
      </div>

      <main className="relative mx-auto -mt-20 w-full max-w-lg px-4 pb-10">
        <BookingForm slug={slug} restaurantName={info.name} />
        <p className="mt-8 text-center text-xs text-muted-foreground">Propulsé par MYRESTO</p>
      </main>
    </div>
  );
}
