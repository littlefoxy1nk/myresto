"use client";

import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAX_DAYS_AHEAD, MAX_ONLINE_PARTY_SIZE, MIN_LEAD_MINUTES, type ServiceAvailability } from "@/modules/booking/logic";
import { getBookingAvailability, submitBookingRequest } from "@/modules/booking/server/actions";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function BookingForm({ slug, restaurantName }: { slug: string; restaurantName: string }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  // Les créneaux dépendent du jour ET du nombre de personnes (un service peut être complet pour 6 mais pas pour 2).
  const key = `${date}|${partySize}`;
  const [availability, setAvailability] = useState<{ key: string; services: ServiceAvailability[]; error?: string } | null>(null);
  const loading = availability?.key !== key;

  useEffect(() => {
    let cancelled = false;
    getBookingAvailability(slug, date, partySize)
      .then((res) => {
        if (cancelled) return;
        setAvailability(res.ok ? { key, services: res.services } : { key, services: [], error: res.error });
      })
      .catch(() => !cancelled && setAvailability({ key, services: [], error: "Impossible de charger les heures." }));
    return () => {
      cancelled = true;
    };
  }, [slug, date, partySize, key]);

  const sections = availability?.key === key ? availability.services : [];
  const hasAnyTime = sections.some((sv) => sv.times.length > 0);
  const stillSelected = sections.some((sv) => sv.times.includes(time));

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
              {
                firstName,
                lastName,
                phone,
                email: email || undefined,
                partySize,
                date,
                time,
                notes: notes || undefined,
                newsletterOptIn: newsletterOptIn && !!email.trim(),
              },
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

        <label
          className={`flex items-start gap-3 rounded-xl border border-border p-3 text-sm ${email.trim() ? "cursor-pointer" : "opacity-60"}`}
        >
          <input
            type="checkbox"
            checked={newsletterOptIn && !!email.trim()}
            disabled={!email.trim()}
            onChange={(e) => setNewsletterOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium">Je veux recevoir les infos et actualités du restaurant par email</span>
            <span className="block text-xs text-muted-foreground">
              {email.trim()
                ? "Facultatif. Tu pourras te désinscrire à tout moment depuis chaque mail."
                : "Indique ton email ci-dessus pour pouvoir cocher cette case."}
            </span>
          </span>
        </label>

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

        <div className="space-y-2">
          <span className="text-sm font-medium">Heure *</span>
          {loading ? (
            <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">Recherche des heures…</p>
          ) : availability?.error ? (
            <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">{availability.error}</p>
          ) : sections.length === 0 ? (
            <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">Le restaurant est fermé ce jour-là.</p>
          ) : (
            sections.map((sv) => (
              <div key={sv.id} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {sv.name} · {sv.startTime}–{sv.endTime}
                </p>
                {sv.times.length === 0 ? (
                  <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {sv.full ? "Complet — appelle le restaurant pour une éventuelle place." : "Plus de créneau en ligne pour ce service."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Heure d'arrivée, ${sv.name}`}>
                    {sv.times.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={time === t}
                        onClick={() => setTime(t)}
                        className={`rounded-xl border px-3.5 py-2 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                          time === t ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
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

        <Button type="submit" size="lg" className="w-full" disabled={pending || loading || !hasAnyTime || !stillSelected}>
          {pending ? "Envoi…" : "Envoyer ma demande"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Réservation en ligne jusqu&apos;à {MAX_ONLINE_PARTY_SIZE} personnes, au moins {Math.floor(MIN_LEAD_MINUTES / 60)} h {String(MIN_LEAD_MINUTES % 60).padStart(2, "0")} avant l&apos;heure choisie — sinon, appelle le
          restaurant. Elle n&apos;est valable qu&apos;une fois confirmée par lui.
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
