"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlanningAlerts } from "@/modules/planning/components/planning-alerts";
import { FrequentationSummary } from "@/modules/planning/components/frequentation-summary";
import { ShiftFormDialog, type ShiftFormValues } from "@/modules/planning/components/shift-form-dialog";
import { ObjectiveDialog } from "@/modules/planning/components/objective-dialog";
import { createShift, updateShift, deleteShift, duplicateWeek } from "@/modules/planning/server/actions";
import { SHIFT_POSITION_LABELS } from "@/modules/planning/types";
import type { PlanningMember, PlanningShift, ShiftConflictLevel, ShiftPosition, WeekPlanningResult } from "@/modules/planning/types";

function formatHours(h: number) {
  const rounded = Math.round(h * 10) / 10;
  return `${rounded}h`;
}

const CONFLICT_DOT_CLASS: Record<ShiftConflictLevel, string> = {
  ok: "bg-good",
  warning: "bg-important",
  conflict: "bg-urgent",
};

function ConflictDot({ level }: { level: ShiftConflictLevel }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", CONFLICT_DOT_CLASS[level])} aria-hidden="true" />;
}

function ConflictLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <ConflictDot level="ok" /> OK
      </span>
      <span className="flex items-center gap-1.5">
        <ConflictDot level="warning" /> À vérifier
      </span>
      <span className="flex items-center gap-1.5">
        <ConflictDot level="conflict" /> Conflit réel
      </span>
    </div>
  );
}

type DialogState =
  | { mode: "create"; membershipId: string; date: string }
  | { mode: "edit"; shift: PlanningShift }
  | null;

export function PlanningApp({
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
  const [selectedDay, setSelectedDay] = useState(
    data.weekDays.includes(todayKey) ? todayKey : data.weekDays[0]
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [objectiveFor, setObjectiveFor] = useState<PlanningMember | null>(null);
  const activeDayTabRef = useRef<HTMLButtonElement>(null);

  // Le jour sélectionné (aujourd'hui par défaut) doit être visible sans que la
  // personne ait à deviner qu'il faut faire défiler la rangée d'onglets.
  useEffect(() => {
    activeDayTabRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selectedDay]);

  const shiftsByMemberDay = new Map<string, PlanningShift[]>();
  for (const s of data.shifts) {
    const key = `${s.membershipId}|${s.date}`;
    const list = shiftsByMemberDay.get(key) ?? [];
    list.push(s);
    shiftsByMemberDay.set(key, list);
  }

  async function guarded(action: () => Promise<unknown>, successMessage?: string) {
    try {
      await action();
      if (successMessage) toast(successMessage);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      throw err;
    }
  }

  async function handleSave(values: ShiftFormValues) {
    if (dialog?.mode === "edit") {
      await guarded(() => updateShift(dialog.shift.id, values), "Shift modifié");
    } else {
      await guarded(() => createShift(values), "Shift ajouté");
    }
    setDialog(null);
  }

  const nextWeekStartKey = format(addDays(new Date(`${data.weekStart}T00:00:00`), 7), "yyyy-MM-dd");

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const count = await duplicateWeek(data.weekStart, nextWeekStartKey);
      toast(`${count} shift${count > 1 ? "s" : ""} dupliqué${count > 1 ? "s" : ""} vers la semaine suivante`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    } finally {
      setDuplicating(false);
    }
  }

  function handleDeleteConfirm() {
    if (!deleteId) return;
    guarded(() => deleteShift(deleteId), "Shift supprimé").catch(() => {});
    setDeleteId(null);
  }

  /// Objectif de services d'une personne : un fait ("5/8"), et si non atteint, une
  /// explication concrète (jours encore compatibles, ou pourquoi c'est impossible) —
  /// jamais juste un chiffre sans contexte.
  function renderObjective(m: PlanningMember) {
    const objective = data.objectivesByMember[m.membershipId];
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {objective && (
          <span
            className={cn(
              "text-xs font-medium",
              objective.status === "impossible" ? "text-urgent" : objective.status === "incomplet" ? "text-important" : "text-good"
            )}
          >
            🎯 {objective.planned}/{objective.target} services
          </span>
        )}
        {data.canEdit && (
          <button
            onClick={() => setObjectiveFor(m)}
            aria-label={`Définir l'objectif de services de ${m.firstName}`}
            className="rounded-md p-0.5 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Target size={12} aria-hidden="true" />
          </button>
        )}
        {objective && objective.status === "incomplet" && (
          <p className="w-full text-xs text-muted-foreground">
            {objective.remaining} service{objective.remaining > 1 ? "s" : ""} restant{objective.remaining > 1 ? "s" : ""} —
            compatible {objective.compatibleDayLabels.join(", ")}
          </p>
        )}
        {objective && objective.status === "impossible" && (
          <p className="w-full text-xs text-urgent">
            Objectif impossible avec les contraintes actuelles ({objective.compatibleSlotsRemaining} créneau
            {objective.compatibleSlotsRemaining > 1 ? "x" : ""} compatible{objective.compatibleSlotsRemaining > 1 ? "s" : ""} pour{" "}
            {objective.remaining} restant{objective.remaining > 1 ? "s" : ""}).
          </p>
        )}
      </div>
    );
  }

  function renderShifts(membershipId: string, date: string) {
    const shifts = shiftsByMemberDay.get(`${membershipId}|${date}`) ?? [];
    return (
      <div className="flex min-h-[3rem] flex-col gap-1">
        {shifts.map((s) => {
          const chipClass = cn(
            "rounded-lg border px-2 py-1 text-left text-[11px] leading-tight",
            s.conflictLevel === "conflict"
              ? "border-urgent bg-urgent-soft text-urgent"
              : s.conflictLevel === "warning"
                ? "border-important bg-important-soft text-important"
                : "border-border bg-muted"
          );
          const content = (
            <>
              <div className="font-medium">
                {s.startTime}–{s.endTime}
              </div>
              <div className={s.conflictLevel === "ok" ? "truncate text-muted-foreground" : "truncate"}>
                {SHIFT_POSITION_LABELS[s.position as keyof typeof SHIFT_POSITION_LABELS] ?? s.position}
              </div>
              {s.warnings.map((w) => (
                <div key={w.message} className="mt-0.5 font-medium">
                  {w.message}
                </div>
              ))}
            </>
          );
          return data.canEdit ? (
            <button
              key={s.id}
              onClick={() => setDialog({ mode: "edit", shift: s })}
              className={cn(chipClass, "outline-none transition-colors hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent")}
            >
              {content}
            </button>
          ) : (
            <div key={s.id} className={chipClass}>
              {content}
            </div>
          );
        })}
        {data.canEdit && (
          <button
            onClick={() => setDialog({ mode: "create", membershipId, date })}
            aria-label="Ajouter un shift"
            className="flex items-center justify-center rounded-lg border border-dashed border-border py-1.5 text-muted-foreground outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  const dialogInitial =
    dialog?.mode === "edit"
      ? {
          membershipId: dialog.shift.membershipId,
          serviceId: dialog.shift.serviceId,
          date: dialog.shift.date,
          startTime: dialog.shift.startTime,
          endTime: dialog.shift.endTime,
          position: dialog.shift.position as ShiftPosition,
        }
      : dialog?.mode === "create"
        ? { membershipId: dialog.membershipId, date: dialog.date }
        : {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.totalTeamHours > 0
              ? `${formatHours(data.totalTeamHours)} planifiées cette semaine pour l'équipe`
              : "Aucun shift planifié cette semaine"}
          </p>
        </div>
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
          {data.canEdit && data.shifts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDuplicate(true)} disabled={duplicating}>
              <Copy size={14} aria-hidden="true" />
              Dupliquer
            </Button>
          )}
        </div>
      </div>

      <PlanningAlerts alerts={data.alerts} />
      <FrequentationSummary days={data.dayFrequentation} />
      {data.members.length > 0 && <ConflictLegend />}

      {data.members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucun membre actif dans l&apos;équipe.
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
                {data.members.map((m) => (
                  <tr key={m.membershipId} className="border-b border-border last:border-0">
                    <td className="p-3 align-top">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <ConflictDot level={data.memberWeekStatus[m.membershipId] ?? "ok"} />
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatHours(data.totalHoursByMember[m.membershipId] ?? 0)}
                        {m.weeklyHoursTarget ? ` / ${m.weeklyHoursTarget}h` : ""}
                        {m.maxShiftsPerWeek != null && ` · ${data.shiftsCountByMember[m.membershipId] ?? 0}/${m.maxShiftsPerWeek} shifts`}
                      </p>
                      {renderObjective(m)}
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
              {data.members.map((m) => (
                <div key={m.membershipId} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <ConflictDot level={data.memberWeekStatus[m.membershipId] ?? "ok"} />
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatHours(data.totalHoursByMember[m.membershipId] ?? 0)}
                      {m.weeklyHoursTarget ? ` / ${m.weeklyHoursTarget}h` : ""}
                      {m.maxShiftsPerWeek != null && ` · ${data.shiftsCountByMember[m.membershipId] ?? 0}/${m.maxShiftsPerWeek} shifts`}
                    </p>
                  </div>
                  {renderObjective(m)}
                  <div className="mt-2">{renderShifts(m.membershipId, selectedDay)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {dialog && (
        <ShiftFormDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          members={data.members}
          services={data.services}
          initial={dialogInitial}
          editingShiftId={dialog.mode === "edit" ? dialog.shift.id : null}
          allShifts={data.shifts}
          availabilitiesByMember={data.availabilitiesByMember}
          absentMembershipIdsByDate={data.absentMembershipIdsByDate}
          shiftsCountByMember={data.shiftsCountByMember}
          onSave={handleSave}
          onDelete={dialog.mode === "edit" ? () => { setDeleteId(dialog.shift.id); setDialog(null); } : undefined}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Supprimer ce shift ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        onConfirm={handleDeleteConfirm}
      />
      <ConfirmDialog
        open={confirmDuplicate}
        onOpenChange={setConfirmDuplicate}
        title="Dupliquer cette semaine ?"
        description="Tous les shifts de cette semaine seront copiés vers la semaine suivante, jour pour jour. Les shifts déjà présents sur la semaine suivante ne sont pas remplacés."
        confirmLabel="Dupliquer"
        destructive={false}
        onConfirm={handleDuplicate}
      />
      {objectiveFor && (
        <ObjectiveDialog
          open
          onOpenChange={(o) => !o && setObjectiveFor(null)}
          membershipId={objectiveFor.membershipId}
          memberName={`${objectiveFor.firstName} ${objectiveFor.lastName}`}
          currentTarget={data.objectivesByMember[objectiveFor.membershipId]?.target ?? null}
        />
      )}
    </div>
  );
}
