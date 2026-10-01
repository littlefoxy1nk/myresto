"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { setStaffingRequirement, generateWeekSchedule } from "@/modules/planning/server/actions";
import {
  SHIFT_POSITION_LABELS,
  STAFFABLE_POSITIONS,
  type PlanningServiceDefinition,
  type ShiftPosition,
  type StaffingRequirementCell,
} from "@/modules/planning/types";

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

function cellKey(dayOfWeek: number, serviceId: string, position: ShiftPosition) {
  return `${dayOfWeek}|${serviceId}|${position}`;
}

/// Besoins en personnel par (jour, service, poste) — la cible que "Créer l'horaire"
/// essaie d'atteindre à partir des disponibilités et objectifs déjà déclarés (voir
/// generateScheduleAssignments, planning/compute.ts). Volontairement replié par défaut :
/// la plupart des visites du Planning n'ont pas besoin d'y toucher.
export function StaffingRequirementsPanel({
  requirements,
  services,
  weekStart,
}: {
  requirements: StaffingRequirementCell[];
  services: PlanningServiceDefinition[];
  weekStart: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const r of requirements) map[cellKey(r.dayOfWeek, r.serviceId, r.position)] = r.requiredCount;
    return map;
  });
  const [, startSaveTransition] = useTransition();
  const [generating, setGenerating] = useState(false);

  function save(dayOfWeek: number, serviceId: string, position: ShiftPosition, requiredCount: number) {
    startSaveTransition(async () => {
      try {
        await setStaffingRequirement({ dayOfWeek, serviceId, position, requiredCount });
      } catch (err) {
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { created } = await generateWeekSchedule(weekStart);
      if (created === 0) {
        toast("Rien à ajouter — tous les créneaux sont déjà couverts ou personne n'est éligible.");
      } else {
        toast(`${created} shift${created > 1 ? "s" : ""} proposé${created > 1 ? "s" : ""} en brouillon — à relire avant de publier.`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    } finally {
      setGenerating(false);
    }
  }

  if (services.length === 0) return null;

  return (
    <Card className="space-y-3 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Besoins en personnel
        <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Combien de personnes il faut à chaque service, par poste — sert de base à &quot;Créer l&apos;horaire&quot;
            ci-dessous.
          </p>
          {STAFFABLE_POSITIONS.map((position) => (
            <div key={position} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {SHIFT_POSITION_LABELS[position]}
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-[480px] border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="w-28 p-1.5 text-left font-medium text-muted-foreground">Service</th>
                      {DAYS.map((d) => (
                        <th key={d.value} className="p-1.5 text-center font-medium text-muted-foreground">
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service) => (
                      <tr key={service.id} className="border-t border-border">
                        <td className="p-1.5 font-medium">{service.name}</td>
                        {DAYS.map((d) => {
                          const active = service.daysOfWeek.includes(d.value);
                          if (!active) return <td key={d.value} className="p-1.5 text-center text-muted-foreground">—</td>;
                          const key = cellKey(d.value, service.id, position);
                          return (
                            <td key={d.value} className="p-1.5 text-center">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={values[key] ?? 0}
                                onChange={(e) => {
                                  const next = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                                  setValues((prev) => ({ ...prev, [key]: next }));
                                }}
                                onBlur={(e) => {
                                  const next = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                                  save(d.value, service.id, position, next);
                                }}
                                className="h-7 w-12 rounded-lg border border-border bg-background text-center outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            <Wand2 size={14} aria-hidden="true" />
            {generating ? "Génération…" : "Créer l'horaire"}
          </Button>
        </div>
      )}
    </Card>
  );
}
