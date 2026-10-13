"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isoWeekday } from "@/lib/time";
import { bookingSlots, selectableSlots, MAX_DAYS_AHEAD, MAX_ONLINE_PARTY_SIZE } from "@/modules/booking/logic";
import { submitBookingRequest } from "@/modules/booking/server/actions";

type PublicService = { id: string; name: string; startTime: string; endTime: string; days: number[] };

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function BookingForm({
  slug,
  restaurantName,
  services,
}: {
  slug: string;
  restaurantName: string;
  services: PublicService[];
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const slots = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return [];
    const weekday = isoWeekday(d);
    return selectableSlots(bookingSlots(services.filter((s) => s.days.includes(weekday))), date === today, new Date());
  }, [date, today, services]);

  if (done) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <CheckCircle2 size={28} className="mx-auto text-good" aria-hidden="true" />
        <p className="text-base font-semibold">Demande envoyée</p>
        <p className="text-sm text-muted-foreground">
          {restaurantName} a bien reçu ta demande pour {partySize} personne{partySize > 1 ? "s" : ""} le{" "}
          {format(new Date(`${date}T00:00:00`), "dd/MM/yyyy")} à {time}. Tu recevras un message pour la confirmer : la
          réservation n&apos;est valable qu&apos;une fois confirmée.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!time) return setError("Choisis une heure.");
          setPending(true);
          try {
            const result = await submitBookingRequest(
              slug,
              { firstName, lastName, phone, email: email || undefined, partySize, date, time, notes: notes || undefined },
              website
            );
            if (result.ok) setDone(true);
            else setError(result.error);
          } catch {
            setError("Une erreur est survenue, réessaie dans un instant.");
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Labeled id="bk-first" label="Prénom *">
            <input id="bk-first" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </Labeled>
          <Labeled id="bk-last" label="Nom *">
            <input id="bk-last" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </Labeled>
        </div>
        <Labeled id="bk-phone" label="GSM *">
          <input id="bk-phone" required type="tel" autoComplete="tel" inputMode="tel" placeholder="0475 12 34 56" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Labeled>
        <Labeled id="bk-email" label="Email (facultatif)">
          <input id="bk-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Labeled>

        <div className="grid grid-cols-2 gap-3">
          <Labeled id="bk-size" label="Personnes *">
            <input
              id="bk-size"
              required
              type="number"
              min={1}
              max={MAX_ONLINE_PARTY_SIZE}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              className={inputClass}
            />
          </Labeled>
          <Labeled id="bk-date" label="Date *">
            <input
              id="bk-date"
              required
              type="date"
              min={today}
              max={format(addDays(new Date(), MAX_DAYS_AHEAD), "yyyy-MM-dd")}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTime("");
              }}
              className={inputClass}
            />
          </Labeled>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Heure *</span>
          {slots.length === 0 ? (
            <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">Le restaurant est fermé ce jour-là.</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Heure d'arrivée">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={time === s}
                  onClick={() => setTime(s)}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    time === s ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <Labeled id="bk-notes" label="Un message ? (allergie, occasion… facultatif)">
          <textarea id="bk-notes" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </Labeled>

        {/* Champ piège : invisible pour une personne, rempli par les robots. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Ne pas remplir
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        {error && (
          <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending || slots.length === 0}>
          {pending ? "Envoi…" : "Envoyer ma demande"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Ta réservation est confirmée par le restaurant. Pour plus de {MAX_ONLINE_PARTY_SIZE} personnes, appelle-le directement.
        </p>
      </form>
    </Card>
  );
}

function Labeled({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
