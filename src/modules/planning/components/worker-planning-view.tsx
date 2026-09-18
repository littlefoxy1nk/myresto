"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlanningNotes } from "@/modules/planning/components/planning-notes";
import { PlanningZoneTabs, type PlanningZoneFilter } from "@/modules/planning/components/planning-zone-tabs";
import { SHIFT_POSITION_LABELS, POSITIONS_BY_ZONE } from "@/modules/planning/types";
import type { PlanningShift, ShiftPosition, WeekPlanningResult } from "@/modules/planning/types";

/// Vue employé du planning — jamais les alertes RH, les conflits ou le statut des
/// congés d'un tiers (voir la décision produit) : uniquement l'horaire et les notes du
/// manager (PlanningNotes). Volontairement un composant séparé de PlanningApp plutôt
/// qu'un mode conditionnel dans le même fichier — les deux vues divergent sur presque
/// tout l'affichage, les mélanger aurait produit plus de branches que de lignes
/// partagées.
export function WorkerPlanningView({
  data,
  prevWeekHref,
  nextWeekHref,
  currentWeekHref,
  isCurrentWeek,
}: {
  data: WeekPlanningResult;
  prevWeekHref: string;
  nextWeekHref: string;
  currentWeekHref: string;
  isCurrentWeek: boolean;
}) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const [selectedDay, setSelectedDay] = useState(data.weekDays.includes(todayKey) ? todayKey : data.weekDays[0]);
  const [zone, setZone] = useState<PlanningZoneFilter>("tous");
  const activeDayTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeDayTabRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selectedDay]);

  const visiblePositions = zone === "tous" ? null : POSITIONS_BY_ZONE[zone];
  const visibleShifts = visiblePositions ? data.shifts.filter((s) => visiblePositions.includes(s.position as ShiftPosition)) : data.shifts;
  const visibleMembers =
    zone === "tous" ? data.members : data.members.filter((m) => visibleShifts.some((s) => s.membershipId === m.membershipId));

  const shiftsByMemberDay = new Map<string, PlanningShift[]>();
  for (const s of visibleShifts) {
    const key = `${s.membershipId}|${s.date}`;
    const list = shiftsByMemberDay.get(key) ?? [];
    list.push(s);
    shiftsByMemberDay.set(key, list);
  }

  function renderShifts(membershipId: string, date: string) {
    const shifts = shiftsByMemberDay.get(`${membershipId}|${date}`) ?? [];
    if (shifts.length === 0) return <div className="min-h-[2.5rem]" />;
    return (
      <div className="flex flex-col gap-1">
        {shifts.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-muted px-2 py-1 text-left text-[11px] leading-tight">
            <div className="font-medium">
              {s.startTime}–{s.endTime}
            </div>
            <div className="truncate text-muted-foreground">
              {SHIFT_POSITION_LABELS[s.position as keyof typeof SHIFT_POSITION_LABELS] ?? s.position}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Planning</h1>
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm">
            <Link href={prevWeekHref} aria-label="Semaine précédente">
              <ChevronLeft size={16} aria-hidden="true" />
            </Link>
          </Button>
          {!isCurrentWeek && (
            <Button asChild variant="secondary" size="sm">
              <Link href={currentWeekHref}>Cette semaine</Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href={nextWeekHref} aria-label="Semaine suivante">
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <PlanningNotes notes={data.notes} canEdit={false} />

      {data.members.length > 0 && <PlanningZoneTabs value={zone} onChange={setZone} />}

      {data.members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucun membre actif dans l&apos;équipe.
        </p>
      ) : visibleMembers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Personne n&apos;a de shift dans cette zone cette semaine.
        </p>
      ) : (
        <>
          {/* Vue semaine — desktop */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-44 shrink-0 p-3 text-left text-xs font-medium text-muted-foreground">Équipe</th>
                  {data.weekDays.map((date) => (
                    <th key={date} className="p-3 text-left text-xs font-medium text-muted-foreground">
                      {data.dayLabels[date]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((m) => (
                  <tr key={m.membershipId} className="border-b border-border last:border-0">
                    <td className="p-3 align-top text-sm font-medium">
                      {m.firstName} {m.lastName}
                    </td>
                    {data.weekDays.map((date) => (
                      <td key={date} className="p-1.5 align-top">
                        {renderShifts(m.membershipId, date)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vue jour — mobile */}
          <div className="space-y-3 md:hidden">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {data.weekDays.map((date) => (
                <button
                  key={date}
                  ref={date === selectedDay ? activeDayTabRef : undefined}
                  onClick={() => setSelectedDay(date)}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    date === selectedDay ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-foreground"
                  )}
                >
                  {data.dayLabels[date]}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {visibleMembers.map((m) => (
                <div key={m.membershipId} className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-sm font-medium">
                    {m.firstName} {m.lastName}
                  </p>
                  <div className="mt-2">{renderShifts(m.membershipId, selectedDay)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
