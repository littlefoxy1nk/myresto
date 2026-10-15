"use client";

import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { CalendarDays, Check, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { MAX_DAYS_AHEAD, MAX_ONLINE_PARTY_SIZE, MIN_LEAD_MINUTES, type ServiceAvailability } from "@/modules/booking/logic";
import { getBookingAvailability, submitBookingRequest } from "@/modules/booking/server/actions";

const inputClass =
  "w-full rounded-2xl border border-border bg-card/80 px-4 py-3 text-base outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

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
  const [pickOther, setPickOther] = useState(false);
  // Les 14 prochains jours en pastilles ; au-delà, « Autre » ouvre le calendrier.
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
  const inQuickDays = days.some((d) => format(d, "yyyy-MM-dd") === date);

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

  const longDate = frDate(date, { weekday: "long", day: "numeric", month: "long" });

  if (done) {
    return (
      <Card className="page-in space-y-6 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-good-soft text-good">
          <Check size={32} strokeWidth={3} aria-hidden="true" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">Demande envoyée</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{restaurantName} a bien reçu ta demande.</p>
        </div>
        <dl className="mx-auto grid max-w-xs grid-cols-3 gap-2 text-center">
          <Recap label="Quand" value={frDate(date, { day: "numeric", month: "short" })} />
          <Recap label="Heure" value={time} />
          <Recap label="Pers." value={String(partySize)} />
        </dl>
        <p className="rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
          Tu recevras un message pour confirmer. La réservation n&apos;est valable <span className="font-semibold text-foreground">qu&apos;une fois confirmée</span> par le restaurant.
        </p>
      </Card>
    );
  }

  return (
    <Card className="shadow-pop">
      <form
        className="divide-y divide-border"
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
        <Section n={1} title="Quand veux-tu venir ?">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true">
                  <Users size={17} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Personnes</p>
                  <p className="text-xs text-muted-foreground">Jusqu&apos;à {MAX_ONLINE_PARTY_SIZE} en ligne</p>
                </div>
              </div>
              <NumberStepper
                value={partySize}
                onChange={(n) => {
                  setPartySize(n);
                  setTime("");
                }}
                min={1}
                max={MAX_ONLINE_PARTY_SIZE}
                label="Nombre de personnes"
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold">Jour</span>
              <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Jour de la réservation">
                {days.map((d, i) => {
                  const key = format(d, "yyyy-MM-dd");
                  const active = key === date;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setDate(key);
                        setTime("");
                        setPickOther(false);
                      }}
                      className={cn(
                        "flex w-[3.75rem] shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent",
                        active ? "border-transparent bg-ink text-ink-foreground shadow-sm" : "border-border bg-card/70 hover:bg-muted"
                      )}
                    >
                      <span className={cn("text-[11px] font-semibold uppercase", active ? "text-ink-foreground/70" : "text-muted-foreground")}>
                        {i === 0 ? "Auj." : i === 1 ? "Dem." : frDate(key, { weekday: "short" }).replace(".", "")}
                      </span>
                      <span className="text-xl font-bold tabular-nums leading-none">{d.getDate()}</span>
                      <span className={cn("text-[11px]", active ? "text-ink-foreground/70" : "text-muted-foreground")}>{frDate(key, { month: "short" }).replace(".", "")}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPickOther((v) => !v)}
                  aria-expanded={pickOther || !inQuickDays}
                  className={cn(
                    "flex w-[3.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-[11px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent",
                    !inQuickDays ? "border-transparent bg-ink text-ink-foreground" : "border-dashed border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <CalendarDays size={18} aria-hidden="true" />
                  Autre
                </button>
              </div>
              {(pickOther || !inQuickDays) && (
                <input
                  id="bk-date"
                  aria-label="Choisir une autre date"
                  type="date"
                  min={today}
                  max={format(addDays(new Date(), MAX_DAYS_AHEAD), "yyyy-MM-dd")}
                  value={date}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setDate(e.target.value);
                    setTime("");
                  }}
                  className={inputClass}
                />
              )}
            </div>

            <div className="space-y-2.5">
              <span className="text-sm font-semibold">Heure</span>
              {loading ? (
                <div className="grid grid-cols-4 gap-2" aria-label="Recherche des heures…">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="skeleton h-11 rounded-2xl" />
                  ))}
                </div>
              ) : availability?.error ? (
                <Notice>{availability.error}</Notice>
              ) : sections.length === 0 ? (
                <Notice>Le restaurant est fermé ce jour-là.</Notice>
              ) : (
                sections.map((sv) => (
                  <div key={sv.id} className="space-y-2">
                    {sections.length > 1 && <p className="text-xs font-semibold text-muted-foreground">{sv.name}</p>}
                    {sv.times.length === 0 ? (
                      <Notice>
                        {sv.full ? "Complet — appelle le restaurant pour une éventuelle place." : "Plus de créneau en ligne pour ce service."}
                      </Notice>
                    ) : (
                      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={`Heure d'arrivée, ${sv.name}`}>
                        {sv.times.map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={time === t}
                            onClick={() => setTime(t)}
                            className={cn(
                              "rounded-2xl border py-3 text-sm font-semibold tabular-nums outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent active:scale-95",
                              time === t ? "border-transparent bg-accent text-accent-foreground shadow-sm" : "border-border bg-card/70 hover:bg-muted"
                            )}
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
          </div>
        </Section>

        <Section n={2} title="Tes coordonnées">
          <div className="space-y-3.5">
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

            <label className={cn("flex items-start gap-3 rounded-2xl border border-border p-3.5 text-sm transition-colors", email.trim() ? "cursor-pointer hover:bg-muted/50" : "opacity-60")}>
              <input
                type="checkbox"
                checked={newsletterOptIn && !!email.trim()}
                disabled={!email.trim()}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="font-semibold">Je veux recevoir les infos et actualités du restaurant par email</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {email.trim()
                    ? "Facultatif. Tu pourras te désinscrire à tout moment depuis chaque mail."
                    : "Indique ton email ci-dessus pour pouvoir cocher cette case."}
                </span>
              </span>
            </label>
          </div>
        </Section>

        <Section n={3} title="Un petit mot ?" optional>
          <Labeled id="bk-notes" label="Allergie, occasion spéciale…">
            <textarea id="bk-notes" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </Labeled>
        </Section>

        {/* Champ piège : invisible pour une personne, rempli par les robots. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Ne pas remplir
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <div className="space-y-3.5 p-6">
          {time && (
            <p className="rounded-2xl bg-accent-soft px-4 py-3 text-center text-sm font-semibold text-accent first-letter:uppercase">
              {longDate} · {time} · {partySize} personne{partySize > 1 ? "s" : ""}
            </p>
          )}
          {error && (
            <p className="rounded-2xl bg-urgent-soft px-4 py-3 text-sm font-medium text-urgent" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending || loading || !hasAnyTime || !stillSelected}>
            {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {pending ? "Envoi…" : "Envoyer ma demande"}
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Réservation en ligne jusqu&apos;à {MAX_ONLINE_PARTY_SIZE} personnes, au moins {Math.floor(MIN_LEAD_MINUTES / 60)} h {String(MIN_LEAD_MINUTES % 60).padStart(2, "0")} avant l&apos;heure choisie — sinon, appelle le
            restaurant. Elle n&apos;est valable qu&apos;une fois confirmée par lui.
          </p>
        </div>
      </form>
    </Card>
  );
}

/// « ven. », « 16 », « octobre »… dans la langue du restaurant, sans fuseau (la date est une clé yyyy-MM-dd).
function frDate(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("fr-BE", options).format(new Date(`${dateKey}T00:00:00`));
}

function Section({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <section className="p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold tracking-tight">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-ink-foreground" aria-hidden="true">
          {n}
        </span>
        {title}
        {optional && <span className="text-xs font-medium text-muted-foreground">facultatif</span>}
      </h2>
      {children}
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">{children}</p>;
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/70 px-2 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Labeled({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
