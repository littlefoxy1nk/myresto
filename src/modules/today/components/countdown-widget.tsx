"use client";

import { useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-bus";
import { describeDays } from "@/modules/today/countdown";
import { createCountdownEvent, deleteCountdownEvent } from "@/modules/today/server/actions";

type EventWithDays = { id: string; title: string; date: string; days: number };

const field =
  "w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${dateKey}T00:00:00`)
  );
}

/// Le compte à rebours d'un événement choisi : le plus proche en grand, les suivants en dessous. Les jours sont
/// calculés par le serveur à chaque affichage, rien à mettre à jour à la main.
export function CountdownWidget({ events, canManage }: { events: EventWithDays[]; canManage: boolean }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const main = events[0];
  const others = events.slice(1, 4);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createCountdownEvent({ title, date });
      setTitle("");
      setDate("");
      setAdding(false);
      toast("Événement ajouté");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCountdownEvent(id);
      toast("Événement supprimé");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible de supprimer.", "error");
    }
  }

  return (
    <Card className="relative flex h-full flex-col overflow-hidden border-0 bg-gradient-to-br from-[#c0451f] via-[#b13a2c] to-[#9f1f4d] p-6 text-white shadow-pop">
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <div className="flex items-center justify-between gap-2">
        <p className="relative flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
          <CalendarClock size={13} aria-hidden="true" />
          Compte à rebours
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="relative flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white"
          >
            <Plus size={13} aria-hidden="true" />
            Ajouter
          </button>
        )}
      </div>

      {main ? (
        <div className="relative mt-3 flex-1">
          <p className="text-lg font-semibold tracking-tight">{main.title}</p>
          <p className="mt-0.5 text-xs capitalize text-white/70">{formatDate(main.date)}</p>
          <p className="mt-3 text-6xl font-bold tabular-nums leading-none tracking-tight" aria-live="polite">
            {describeDays(main.days).big}
          </p>
          <p className="mt-1 text-sm text-white/80">{describeDays(main.days).unit}</p>
        </div>
      ) : (
        <div className="relative mt-3 flex-1 text-sm text-white/80">
          <p>Aucun événement à décompter.</p>
          {canManage && <p className="mt-1">Ajoute ce que tu veux (Saint-Valentin, soirée privée, fermeture…) : l&apos;appli compte les jours.</p>}
        </div>
      )}

      {others.length > 0 && (
        <ul className="relative mt-4 space-y-1 border-t border-white/20 pt-3 text-sm">
          {others.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{e.title}</span>
              <span className="shrink-0 tabular-nums text-white/70">{e.days === 1 ? "demain" : `dans ${e.days} j`}</span>
            </li>
          ))}
        </ul>
      )}

      {canManage && events.length > 0 && (
        <details className="relative mt-3 text-xs text-white/70">
          <summary className="cursor-pointer select-none outline-none hover:text-white focus-visible:underline">Gérer les événements</summary>
          <ul className="mt-2 space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {e.title} · {new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(new Date(`${e.date}T00:00:00`))}
                </span>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  aria-label={`Supprimer ${e.title}`}
                  className="rounded-md p-1 outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {adding && (
        <Dialog open onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent>
            <DialogTitle>Nouvel événement</DialogTitle>
            <DialogDescription>Choisis un nom et une date : le décompte se fait tout seul.</DialogDescription>
            <form className="mt-4 space-y-3" onSubmit={add}>
              <div className="space-y-1.5">
                <label htmlFor="cd-title" className="text-sm font-medium">
                  Événement
                </label>
                <input id="cd-title" autoFocus value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="ex : Saint-Valentin" className={field} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cd-date" className="text-sm font-medium">
                  Date
                </label>
                <input id="cd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              {error && (
                <p className="text-sm text-urgent" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending || !title.trim() || !date}>
                {pending ? "Enregistrement…" : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
