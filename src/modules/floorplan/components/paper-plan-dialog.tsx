"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MAX_DAYS = 31;
const FIELD =
  "w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/// « Version papier » : télécharge le plan de salle en PDF (une feuille par salle et par jour, avec table / heure / nb pers / nom) pour un jour ou plusieurs.
export function PaperPlanDialog({ dateKey, zones }: { dateKey: string; zones: { id: string; name: string }[] }) {
  const [from, setFrom] = useState(dateKey);
  const [to, setTo] = useState(dateKey);
  const [zone, setZone] = useState("all");

  const days = from && to ? daysBetween(from, to) : 0;
  const problem = !from || !to ? "Choisis les dates." : days < 1 ? "La date de fin est avant le début." : days > MAX_DAYS ? `Au plus ${MAX_DAYS} jours à la fois.` : null;
  const href = `/api/plan-papier?${new URLSearchParams({ from, to, zone }).toString()}`;

  return (
    <Dialog
      onOpenChange={(open) => {
        // On repart du jour affiché sur le plan à chaque ouverture.
        if (open) {
          setFrom(dateKey);
          setTo(dateKey);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer size={14} aria-hidden="true" />
          Version papier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Plan de salle en version papier</DialogTitle>
        <DialogDescription>
          Un PDF à imprimer : une feuille par jour avec un plan par service (12h, 18h, 20h30…). Les tables de toutes les salles sont rangées dans l&apos;ordre numérique, avec les colonnes heure, nb pers, nom et GSM, remplies avec les réservations. Pour plusieurs jours, une feuille par jour.
        </DialogDescription>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm font-medium">
              Du
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (!to || e.target.value > to) setTo(e.target.value); }} className={FIELD} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Au
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={FIELD} />
            </label>
          </div>
          {zones.length > 1 && (
            <label className="block space-y-1 text-sm font-medium">
              Salle
              <select value={zone} onChange={(e) => setZone(e.target.value)} className={FIELD}>
                <option value="all">Toutes les salles (une seule feuille)</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {problem && <p className="text-sm text-urgent">{problem}</p>}
        </div>

        <div className="mt-5 flex justify-end">
          {problem ? (
            <Button disabled>
              <Download size={16} aria-hidden="true" />
              Télécharger le PDF
            </Button>
          ) : (
            <Button asChild>
              <a href={href} download>
                <Download size={16} aria-hidden="true" />
                Télécharger le PDF
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
