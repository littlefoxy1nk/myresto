"use client";

import { positionTint } from "@/modules/planning/position-tint";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Megaphone, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlanningAlerts } from "@/modules/planning/components/planning-alerts";
import { PlanningNotes } from "@/modules/planning/components/planning-notes";
import { StaffingRequirementsPanel } from "@/modules/planning/components/staffing-requirements-panel";
import { FrequentationSummary } from "@/modules/planning/components/frequentation-summary";
import { ShiftFormDialog, type ShiftFormValues } from "@/modules/planning/components/shift-form-dialog";
import { ObjectiveDialog } from "@/modules/planning/components/objective-dialog";
import { RequestCoverageDialog } from "@/modules/planning/components/request-coverage-dialog";
import { createShift, updateShift, deleteShift, duplicateWeek, publishWeekSchedule } from "@/modules/planning/server/actions";
import { SHIFT_POSITION_LABELS, POSITIONS_BY_ZONE } from "@/modules/planning/types";
import { PlanningZoneTabs, type PlanningZoneFilter } from "@/modules/planning/components/planning-zone-tabs";
import { PlanningViewTabs } from "@/modules/planning/components/planning-view-tabs";
import { buildPlanningRows, defaultServiceForRow, describeDays, hasUsualHours, worstGapsByPosition, type PlanningRow, type PlanningView } from "@/modules/planning/periods";
import type { PlanningMember, PlanningShift, ShiftConflictLevel, ShiftPosition, WeekPlanningResult } from "@/modules/planning/types";

function formatHours(h: number) {
  const rounded = Math.round(h * 10) / 10;
  return `${rounded}h`;
}

function isoDayOfWeek(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 7 : day;
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
  | { mode: "create"; membershipId: string; date: string; serviceId: string | null }
  | { mode: "edit"; shift: PlanningShift }
  | null;

export function PlanningApp({
  data,
  prevWeekHref,
  nextWeekHref,
  currentWeekHref,
  isCurrentWeek,
  view,
  afterHeader,
}: {
  /// Bandeaux à afficher juste sous le titre (services à définir, remplacements en attente).
  afterHeader?: React.ReactNode;
  /// L'affichage choisi pour l'établissement : une ligne par service, ou juste Midi et Soir.
  view: PlanningView;
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
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const draftCount = data.shifts.filter((s) => s.status === "planned").length;
  const [objectiveFor, setObjectiveFor] = useState<PlanningMember | null>(null);
  const [coverageRequestFor, setCoverageRequestFor] = useState<{
    date: string;
    dateLabel: string;
    serviceId: string | null;
    serviceName: string | null;
    startTime: string;
    endTime: string;
    initialPosition: ShiftPosition;
  } | null>(null);
  const [zone, setZone] = useState<PlanningZoneFilter>("tous");
  const [currentView, setCurrentView] = useState<PlanningView>(view);
  const activeDayTabRef = useRef<HTMLButtonElement>(null);

  // Le jour sélectionné (aujourd'hui par défaut) doit être visible sans que la
  // personne ait à deviner qu'il faut faire défiler la rangée d'onglets.
  useEffect(() => {
    activeDayTabRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selectedDay]);

  // Vue Salle/Cuisine (voir PlanningZoneTabs) : filtre les shifts par poste, puis
  // n'affiche que les personnes qui ont effectivement un shift dans cette zone cette
  // semaine — pas tout le monde avec une ligne vide, ce qui serait juste du bruit.
  const visiblePositions = zone === "tous" ? null : POSITIONS_BY_ZONE[zone];
  const visibleShifts = visiblePositions ? data.shifts.filter((s) => visiblePositions.includes(s.position as ShiftPosition)) : data.shifts;
  const visibleMembers =
    zone === "tous" ? data.members : data.members.filter((m) => visibleShifts.some((s) => s.membershipId === m.membershipId));
  const memberById = new Map(data.members.map((m) => [m.membershipId, m]));

  // Affichage "par jour, qui travaille" : la grille est organisée par SERVICE (lignes)
  // × jour (colonnes) — chaque cellule montre directement les personnes concernées,
  // jamais une ligne par personne qu'il faudrait scanner pour trouver qui travaille ce
  // jour-là. Les shifts sans service (rare, "Aucun" dans la modale) vivent sous une
  // ligne à part, ajoutée seulement si elle sert à quelque chose.
  const shiftsByDateService = new Map<string, PlanningShift[]>();
  for (const s of visibleShifts) {
    const key = `${s.date}|${s.serviceId ?? "none"}`;
    const list = shiftsByDateService.get(key) ?? [];
    list.push(s);
    shiftsByDateService.set(key, list);
  }
  const hasUnassignedServiceShifts = visibleShifts.some((s) => s.serviceId == null);
  const serviceRows = buildPlanningRows(data.services, currentView, hasUnassignedServiceShifts);
  const dayColumns = describeDays(data.weekDays, serviceRows, todayKey, isoDayOfWeek);
  const dayColumnByDate = new Map(dayColumns.map((d) => [d.date, d]));
  const shiftCountByDate = new Map<string, number>();
  for (const sh of visibleShifts) shiftCountByDate.set(sh.date, (shiftCountByDate.get(sh.date) ?? 0) + 1);
  const gapDates = new Set(data.staffingGaps.filter((g) => g.required > g.assigned).map((g) => g.date));

  // Creux de personnel (voir computeStaffingGapAlerts) et demandes de renfort en cours,
  // indexés par (jour, service) pour un lookup direct depuis chaque cellule de la grille.
  const gapsByDateService = new Map<string, typeof data.staffingGaps>();
  for (const g of data.staffingGaps) {
    const key = `${g.date}|${g.serviceId}`;
    const list = gapsByDateService.get(key) ?? [];
    list.push(g);
    gapsByDateService.set(key, list);
  }
  const coverageRequestsByDateService = new Map<string, typeof data.coverageRequests>();
  for (const r of data.coverageRequests) {
    const key = `${r.date}|${r.serviceId ?? "none"}`;
    const list = coverageRequestsByDateService.get(key) ?? [];
    list.push(r);
    coverageRequestsByDateService.set(key, list);
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

  async function handlePublish() {
    setPublishing(true);
    try {
      const count = await publishWeekSchedule(data.weekStart);
      toast(`${count} shift${count > 1 ? "s" : ""} publié${count > 1 ? "s" : ""} — visible par l'équipe.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    } finally {
      setPublishing(false);
    }
  }

  function handleDeleteConfirm() {
    if (!deleteId) return;
    guarded(() => deleteShift(deleteId), "Shift supprimé").catch(() => {});
    setDeleteId(null);
  }

  /// Objectif de services d'une personne : un fait visible en texte clair ("Chloé —
  /// 6/8 services"), jamais une icône seule à découvrir par hasard — et si non atteint,
  /// une explication concrète (jours encore compatibles, ou pourquoi c'est impossible,
  /// avec le détail jour par jour). Reste présenté comme une contrainte du planning,
  /// jamais comme une recommandation automatique de personnel.
  function renderObjective(m: PlanningMember) {
    const objective = data.objectivesByMember[m.membershipId];

    if (!objective) {
      if (!data.canEdit) return null;
      return (
        <button
          onClick={() => setObjectiveFor(m)}
          className="mt-1.5 text-xs font-medium text-muted-foreground underline-offset-2 outline-none transition-colors hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        >
          + Définir un objectif de services
        </button>
      );
    }

    const statusColor =
      objective.status === "impossible" ? "text-urgent" : objective.status === "incomplet" ? "text-important" : "text-good";

    return (
      <div className="mt-1.5">
        <button
          onClick={() => data.canEdit && setObjectiveFor(m)}
          disabled={!data.canEdit}
          className={cn(
            "text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent",
            statusColor,
            data.canEdit && "underline-offset-2 hover:underline"
          )}
        >
          {m.firstName} — {objective.planned}/{objective.target} services
        </button>
        {objective.status === "incomplet" && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {objective.remaining} restant{objective.remaining > 1 ? "s" : ""} — compatible avec {objective.compatibleDayLabels.join(", ")}
          </p>
        )}
        {objective.status === "impossible" && (
          <p className="mt-0.5 text-xs text-urgent">
            Objectif impossible avec les contraintes actuelles ({objective.compatibleSlotsRemaining} créneau
            {objective.compatibleSlotsRemaining > 1 ? "x" : ""} pour {objective.remaining} restant{objective.remaining > 1 ? "s" : ""}).
          </p>
        )}
        {/* Le détail jour par jour aide à comprendre "pourquoi" dans les deux cas non
            atteints — pas seulement quand l'objectif devient impossible. */}
        {objective.status !== "atteint" && objective.excludedDays.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {objective.excludedDays.map((e) => `${e.dateLabel} : ${e.reason === "conge" ? "congé" : "indisponible"}`).join(" · ")}
          </p>
        )}
      </div>
    );
  }

  /// Une cellule = un (jour, service) — on y voit directement qui travaille, jamais une
  /// ligne par personne à parcourir. `active` = ce service a lieu ce jour-là (sinon un
  /// tiret, comme dans le panneau "Besoins en personnel") ; "Sans service" est toujours
  /// actif puisqu'il n'a pas de jours propres.
  function renderServiceSlot(row: PlanningRow, date: string, active: boolean) {
    if (!active) {
      return <div className="flex min-h-[3rem] items-center justify-center text-muted-foreground">—</div>;
    }
    // Une ligne peut regrouper plusieurs services (mode Midi / Soir) : on réunit leurs shifts, leurs manques
    // (le pire des services, jamais la somme) et leurs demandes de renfort.
    const shifts = row.serviceIds
      .flatMap((id) => shiftsByDateService.get(`${date}|${id}`) ?? [])
      .sort((a, b) => (row.serviceIds.length > 1 ? a.startTime.localeCompare(b.startTime) : 0));
    const gaps = worstGapsByPosition(row.serviceIds.flatMap((id) => gapsByDateService.get(`${date}|${id}`) ?? []));
    const pendingRequests = row.serviceIds
      .flatMap((id) => coverageRequestsByDateService.get(`${date}|${id}`) ?? [])
      .filter((r) => r.status === "pending");
    const defaultServiceId = defaultServiceForRow(row, data.services, isoDayOfWeek(date));
    const service = data.services.find((s) => s.id === defaultServiceId) ?? null;
    return (
      <div className="flex min-h-[3rem] flex-col gap-1">
        {gaps.map((g) => (
          <div key={g.position} className="rounded-lg border border-urgent bg-urgent-soft px-2 py-1 text-[11px] font-medium text-urgent">
            Manque {g.missing} {SHIFT_POSITION_LABELS[g.position as keyof typeof SHIFT_POSITION_LABELS]?.toLowerCase() ?? g.position}
          </div>
        ))}
        {pendingRequests.map((r) => (
          <div key={r.id} className="truncate rounded-lg border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
            En attente : {r.memberName.split(" ")[0]}
          </div>
        ))}
        {shifts.map((s) => {
          const member = memberById.get(s.membershipId);
          const isDraft = s.status === "planned";
          const chipClass = cn(
            "rounded-2xl border px-2.5 py-1.5 text-left text-[11px] leading-tight",
            isDraft && "border-dashed",
            s.conflictLevel === "conflict"
              ? "border-urgent bg-urgent-soft text-urgent"
              : s.conflictLevel === "warning"
                ? "border-important bg-important-soft text-important"
                : positionTint(s.position)
          );
          // Le détail complet d'un avertissement (texte long) ne s'affiche plus dans la
          // cellule — il alourdissait la grille et le répétait déjà écrit dans le
          // bandeau d'alertes plus haut. Ici : juste un repère court + un titre survolable ;
          // le détail complet reste disponible en un clic (la modale d'édition l'affiche
          // via le même aperçu en temps réel — voir shift-form-dialog.tsx).
          const warningSummary = s.warnings.length === 0 ? null : s.conflictLevel === "conflict" ? "Conflit" : "À vérifier";
          // Les horaires habituels du service ne sont pas répétés sur chaque pastille : seuls ceux qui s'en écartent s'affichent.
          const usual = hasUsualHours(s, row.serviceIds, data.services);
          const detail = `${member ? member.firstName : "?"} · ${s.startTime}–${s.endTime} · ${SHIFT_POSITION_LABELS[s.position as keyof typeof SHIFT_POSITION_LABELS] ?? s.position}`;
          const titleText = [detail, ...s.warnings.map((w) => w.message)].join(" · ");
          const content = (
            <>
              <div className="truncate font-semibold">{member ? member.firstName : "?"}</div>
              <div className={cn("truncate", s.conflictLevel === "ok" && "opacity-75", !usual && "font-semibold opacity-100")}>
                {usual ? "" : `${s.startTime}–${s.endTime} · `}
                {SHIFT_POSITION_LABELS[s.position as keyof typeof SHIFT_POSITION_LABELS] ?? s.position}
              </div>
              {warningSummary && (
                <div className="mt-0.5 flex items-center gap-1 font-medium">
                  <ConflictDot level={s.conflictLevel} />
                  {warningSummary}
                </div>
              )}
              {isDraft && <div className="mt-0.5 font-medium text-muted-foreground">Brouillon</div>}
            </>
          );
          return data.canEdit ? (
            <button
              key={s.id}
              title={titleText}
              onClick={() => setDialog({ mode: "edit", shift: s })}
              className={cn(chipClass, "outline-none transition-colors hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent")}
            >
              {content}
            </button>
          ) : (
            <div key={s.id} title={titleText} className={chipClass}>
              {content}
            </div>
          );
        })}
        {shifts.length === 0 && !data.canEdit && pendingRequests.length === 0 && <span className="m-auto text-muted-foreground">—</span>}
        {data.canEdit && (
          <div className="flex gap-1">
            <button
              onClick={() => setDialog({ mode: "create", membershipId: "", date, serviceId: defaultServiceId })}
              aria-label="Ajouter un shift"
              title="Ajouter directement"
              className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-1.5 text-muted-foreground outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus size={13} aria-hidden="true" />
            </button>
            {service && (
              <button
                onClick={() =>
                  setCoverageRequestFor({
                    date,
                    dateLabel: data.dayLabels[date] ?? date,
                    serviceId: service.id,
                    serviceName: service.name,
                    startTime: service.startTime,
                    endTime: service.endTime,
                    initialPosition: (gaps[0]?.position as ShiftPosition) ?? "salle",
                  })
                }
                aria-label="Demander un renfort"
                title="Demander un renfort à quelqu'un"
                className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-1.5 text-muted-foreground outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                <UserPlus size={13} aria-hidden="true" />
              </button>
            )}
          </div>
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
        ? { membershipId: dialog.membershipId || undefined, date: dialog.date, serviceId: dialog.serviceId }
        : {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planning</h1>
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
          {data.canEdit && draftCount > 0 && (
            <Button size="sm" onClick={() => setConfirmPublish(true)} disabled={publishing}>
              <Megaphone size={14} aria-hidden="true" />
              Publier ({draftCount})
            </Button>
          )}
        </div>
      </div>

      {afterHeader}

      {data.alerts.length > 0 && (
        <a
          href="#alertes"
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-sm font-semibold shadow-sm outline-none transition-shadow hover:shadow-card focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", data.alerts.some((a) => a.severity === "urgent") ? "bg-urgent" : "bg-important")} />
          {data.alerts.length} alerte{data.alerts.length > 1 ? "s" : ""} à voir
          {data.alerts.some((a) => a.severity === "urgent") && (
            <span className="text-urgent">· {data.alerts.filter((a) => a.severity === "urgent").length} urgente{data.alerts.filter((a) => a.severity === "urgent").length > 1 ? "s" : ""}</span>
          )}
          <span aria-hidden="true" className="text-muted-foreground">↓</span>
        </a>
      )}
      {data.canEdit && data.services.length > 1 && <PlanningViewTabs value={currentView} onChange={setCurrentView} />}
      {data.members.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PlanningZoneTabs value={zone} onChange={setZone} />
          <ConflictLegend />
        </div>
      )}

      {serviceRows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucun service n&apos;est configuré pour cet établissement.
        </p>
      ) : (
        <>
          {/* Vue semaine — desktop : par service (lignes) × jour (colonnes), pour voir
              directement qui travaille sans parcourir une ligne par personne. Les colonnes ont
              toutes la même largeur ; un jour où rien n'a lieu se replie, aujourd'hui est mis en avant. */}
          <div className="hidden overflow-x-auto rounded-3xl border border-border/70 bg-card shadow-card md:block">
            <table
              className="w-full table-fixed border-collapse text-sm"
              style={{ minWidth: `${9 + dayColumns.filter((d) => !d.closed).length * 8.5 + dayColumns.filter((d) => d.closed).length * 3}rem` }}
            >
              <colgroup>
                <col style={{ width: "9rem" }} />
                {dayColumns.map((d) => (
                  <col key={d.date} style={d.closed ? { width: "3rem" } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-card p-3 text-left text-xs font-semibold text-muted-foreground">Service</th>
                  {dayColumns.map((d) => (
                    <th
                      key={d.date}
                      className={cn("p-3 text-left align-bottom", d.isToday && "bg-accent-soft/60", d.isPast && !d.isToday && "opacity-60")}
                    >
                      {d.closed ? (
                        <span className="block text-[11px] font-semibold text-muted-foreground [writing-mode:vertical-rl]">{data.dayLabels[d.date]} · fermé</span>
                      ) : (
                        <>
                          <span className={cn("flex items-center gap-1.5 text-xs font-semibold", d.isToday ? "text-accent" : "text-foreground")}>
                            {data.dayLabels[d.date]}
                            {gapDates.has(d.date) && <span className="h-1.5 w-1.5 rounded-full bg-urgent" title="Il manque du personnel ce jour-là" />}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                            {d.isToday ? "Aujourd'hui · " : ""}
                            {shiftCountByDate.get(d.date) ?? 0} shift{(shiftCountByDate.get(d.date) ?? 0) > 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serviceRows.map((service) => (
                  <tr key={service.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-card p-3 align-top">
                      <p className="text-sm font-semibold">{service.name}</p>
                      {service.time && <p className="text-xs tabular-nums text-muted-foreground">{service.time.replace("–", " – ")}</p>}
                    </td>
                    {dayColumns.map((d) => (
                      <td
                        key={d.date}
                        className={cn("p-1.5 align-top", d.isToday && "bg-accent-soft/40", d.isPast && !d.isToday && "opacity-70", d.closed && "bg-muted/40")}
                      >
                        {d.closed ? null : renderServiceSlot(service, d.date, service.daysOfWeek === null || service.daysOfWeek.includes(isoDayOfWeek(d.date)))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vue jour — mobile : mêmes services, un jour à la fois. */}
          <div className="space-y-3 md:hidden">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {data.weekDays.map((date) => (
                <button
                  key={date}
                  ref={date === selectedDay ? activeDayTabRef : undefined}
                  onClick={() => setSelectedDay(date)}
                  className={cn(
                    "shrink-0 rounded-2xl border px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    date === selectedDay ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-foreground"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {data.dayLabels[date]}
                    {gapDates.has(date) && <span className="h-1.5 w-1.5 rounded-full bg-urgent" aria-label="Il manque du personnel" />}
                    {dayColumnByDate.get(date)?.isToday && <span className="rounded-full bg-accent px-1.5 text-[9px] font-bold text-accent-foreground">auj.</span>}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {serviceRows.map((service) => {
                const active = service.daysOfWeek === null || service.daysOfWeek.includes(isoDayOfWeek(selectedDay));
                if (!active) return null;
                return (
                  <div key={service.id} className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-sm font-medium">{service.name}</p>
                    {service.time && <p className="font-mono text-xs text-muted-foreground">{service.time}</p>}
                    <div className="mt-2">{renderServiceSlot(service, selectedDay, true)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Résumé par personne : heures, objectif de services — séparé de la grille
              elle-même, qui répond uniquement à "qui travaille, quel jour". */}
          {visibleMembers.length > 0 && (
            <Card className="space-y-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Équipe</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleMembers.map((m) => (
                  <div key={m.membershipId} className="rounded-2xl border border-border p-3">
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
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Résumé factuel de la semaine — un compte de ce que le bandeau d'alertes détaille
          déjà plus bas, jamais une recommandation ("planning optimal", "il faut X
          serveurs"). Absent si la semaine est calme : pas de carte vide à lire. */}
      {data.weekSummary.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cette semaine</p>
          <p className="mt-1 text-sm">{data.weekSummary.join(" · ")}</p>
        </Card>
      )}

      {data.canEdit && (
        <StaffingRequirementsPanel requirements={data.requirements} services={data.services} weekStart={data.weekStart} />
      )}
      <PlanningNotes notes={data.notes} canEdit={data.canEdit} />
      <PlanningAlerts alerts={data.alerts} weekStart={data.weekStart} dismissedCount={data.dismissedAlertCount} />
      <FrequentationSummary days={data.dayFrequentation} />

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
      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title={`Publier ${draftCount} brouillon${draftCount > 1 ? "s" : ""} ?`}
        description="Ces shifts deviennent visibles par l'équipe et chaque personne concernée reçoit une notification."
        confirmLabel="Publier"
        destructive={false}
        onConfirm={handlePublish}
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
      {coverageRequestFor && (
        <RequestCoverageDialog
          open
          onOpenChange={(o) => !o && setCoverageRequestFor(null)}
          members={data.members}
          allShifts={data.shifts}
          date={coverageRequestFor.date}
          dateLabel={coverageRequestFor.dateLabel}
          serviceId={coverageRequestFor.serviceId}
          serviceName={coverageRequestFor.serviceName}
          startTime={coverageRequestFor.startTime}
          endTime={coverageRequestFor.endTime}
          initialPosition={coverageRequestFor.initialPosition}
        />
      )}
    </div>
  );
}
