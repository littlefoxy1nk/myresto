"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { addDays, differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentContext, requirePermission } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { isoWeekday } from "@/lib/time";
import { notifyMember } from "@/modules/myspace/server/notify";
import { generateScheduleAssignments, isGeneratorEligible, occurrenceAvailabilities, type GeneratorMember, type GeneratorSlot } from "@/modules/planning/compute";
import { SHIFT_POSITIONS, STAFFABLE_POSITIONS, TARGET_SHIFTS_RULE_TYPE, type AvailabilityRow, type ShiftPosition } from "@/modules/planning/types";

function formatShiftDayLabel(date: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const ShiftSchema = z.object({
  membershipId: z.string().min(1),
  serviceId: z.string().min(1).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  position: z.enum(SHIFT_POSITIONS),
});

type ShiftInput = z.infer<typeof ShiftSchema>;

function revalidatePlanningPaths() {
  // Le planning influe sur les heures affichées dans /equipe et sur le staffing du
  // jour dans /aujourdhui — les trois doivent rester synchronisés après toute mutation.
  revalidatePath("/planning");
  revalidatePath("/equipe");
  revalidatePath("/aujourdhui");
}

async function assertOwnership(establishmentId: string, data: ShiftInput) {
  const membership = await prisma.membership.findFirst({ where: { id: data.membershipId, establishmentId } });
  if (!membership) throw new Error("Membre introuvable.");

  if (data.serviceId) {
    const service = await prisma.serviceDefinition.findFirst({ where: { id: data.serviceId, establishmentId } });
    if (!service) throw new Error("Service introuvable.");
  }

  if (data.endTime <= data.startTime) {
    throw new Error("L'heure de fin doit être après l'heure de début.");
  }
}

export async function createShift(input: ShiftInput) {
  const ctx = await requirePermission("schedule.edit");
  const data = ShiftSchema.parse(input);
  await assertOwnership(ctx.establishment.id, data);

  const shift = await prisma.shift.create({
    data: {
      establishmentId: ctx.establishment.id,
      membershipId: data.membershipId,
      serviceId: data.serviceId,
      date: new Date(`${data.date}T00:00:00`),
      startTime: data.startTime,
      endTime: data.endTime,
      position: data.position,
      status: "published",
    },
  });

  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: data.membershipId,
    type: "shift_changed",
    severity: "urgent",
    title: "Un nouveau service vous a été attribué",
    body: `${formatShiftDayLabel(shift.date)} · ${data.startTime}–${data.endTime}`,
    linkHref: "/mon-espace",
  });

  revalidatePlanningPaths();
  return shift;
}

export async function updateShift(id: string, input: ShiftInput) {
  const ctx = await requirePermission("schedule.edit");
  const data = ShiftSchema.parse(input);
  await assertOwnership(ctx.establishment.id, data);

  const existing = await prisma.shift.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Shift introuvable.");

  const shift = await prisma.shift.update({
    where: { id },
    data: {
      membershipId: data.membershipId,
      serviceId: data.serviceId,
      date: new Date(`${data.date}T00:00:00`),
      startTime: data.startTime,
      endTime: data.endTime,
      position: data.position,
    },
  });

  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: data.membershipId,
    type: "shift_changed",
    severity: "urgent",
    title: "Votre horaire a été modifié",
    body: `${formatShiftDayLabel(shift.date)} · ${data.startTime}–${data.endTime}`,
    linkHref: "/mon-espace",
  });
  // Le shift a changé de personne : celle qui le portait avant doit aussi savoir
  // qu'elle ne travaille plus ce créneau, pas seulement la nouvelle personne assignée.
  if (existing.membershipId !== data.membershipId) {
    await notifyMember({
      establishmentId: ctx.establishment.id,
      membershipId: existing.membershipId,
      type: "shift_changed",
      severity: "urgent",
      title: "Un service qui vous était assigné a été réattribué",
      body: `${formatShiftDayLabel(existing.date)} · ${existing.startTime}–${existing.endTime}`,
      linkHref: "/mon-espace",
    });
  }

  revalidatePlanningPaths();
  return shift;
}

export async function deleteShift(id: string) {
  const ctx = await requirePermission("schedule.edit");
  const existing = await prisma.shift.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Shift introuvable.");

  await prisma.shift.delete({ where: { id } });

  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: existing.membershipId,
    type: "shift_cancelled",
    severity: "urgent",
    title: "Un service a été retiré de votre planning",
    body: `${formatShiftDayLabel(existing.date)} · ${existing.startTime}–${existing.endTime}`,
    linkHref: "/mon-espace",
  });

  revalidatePlanningPaths();
}

/// Copie tous les shifts d'une semaine vers une autre, jour de semaine par jour de
/// semaine (lundi de la source -> lundi de la cible, etc.). N'écrase jamais les shifts
/// déjà présents sur la semaine cible — s'ils se chevauchent avec la copie, le badge de
/// conflit existant (evaluateShift) le signalera normalement, sans bloquer la copie.
export async function duplicateWeek(sourceWeekStart: string, targetWeekStart: string) {
  const ctx = await requirePermission("schedule.edit");

  const source = new Date(`${sourceWeekStart}T00:00:00`);
  const target = new Date(`${targetWeekStart}T00:00:00`);
  const sourceEnd = addDays(source, 6);

  const shifts = await prisma.shift.findMany({
    where: {
      establishmentId: ctx.establishment.id,
      date: { gte: startOfDay(source), lte: endOfDay(sourceEnd) },
      status: { not: "cancelled" },
    },
  });
  if (shifts.length === 0) throw new Error("Aucun shift à dupliquer sur cette semaine.");

  await prisma.shift.createMany({
    data: shifts.map((s) => ({
      establishmentId: ctx.establishment.id,
      membershipId: s.membershipId,
      serviceId: s.serviceId,
      date: addDays(target, differenceInCalendarDays(startOfDay(s.date), source)),
      startTime: s.startTime,
      endTime: s.endTime,
      position: s.position,
      status: "published",
    })),
  });

  revalidatePlanningPaths();
  return shifts.length;
}

/// Objectif de services hebdomadaire d'une personne, stocké dans SchedulingRule
/// (réutilisation du modèle existant plutôt qu'un nouveau champ — voir le rapport de
/// mission). `count: null` supprime l'objectif plutôt que de le mettre à zéro : une
/// personne sans objectif défini n'a rien à atteindre, ce n'est pas la même chose
/// qu'un objectif de 0 service.
export async function setServiceObjective(membershipId: string, count: number | null) {
  const ctx = await requirePermission("schedule.edit");

  const membership = await prisma.membership.findFirst({ where: { id: membershipId, establishmentId: ctx.establishment.id } });
  if (!membership) throw new Error("Membre introuvable.");

  const existing = await prisma.schedulingRule.findFirst({
    where: { establishmentId: ctx.establishment.id, membershipId, type: TARGET_SHIFTS_RULE_TYPE },
  });

  if (count == null) {
    if (existing) await prisma.schedulingRule.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.schedulingRule.update({ where: { id: existing.id }, data: { params: JSON.stringify({ count }) } });
  } else {
    await prisma.schedulingRule.create({
      data: {
        establishmentId: ctx.establishment.id,
        membershipId,
        type: TARGET_SHIFTS_RULE_TYPE,
        params: JSON.stringify({ count }),
        isHard: false,
      },
    });
  }

  revalidatePlanningPaths();
}

const PlanningNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  message: z.string().trim().min(1, "Le message est requis.").max(200),
});

/// Rappel factuel du manager sur une date précise (ex: "Jeudi 14h30 : entretien des
/// fûts") — visible par tout le monde sur le planning, y compris la vue simplifiée des
/// employés qui ne voit ni les alertes RH ni les conflits. Jamais un shift ni une
/// tâche assignée : un simple pense-bête daté, voir schema.prisma.
export async function createPlanningNote(input: z.infer<typeof PlanningNoteSchema>) {
  const ctx = await requirePermission("schedule.edit");
  const data = PlanningNoteSchema.parse(input);

  await prisma.planningNote.create({
    data: {
      establishmentId: ctx.establishment.id,
      date: new Date(`${data.date}T00:00:00`),
      time: data.time || null,
      message: data.message,
      createdById: ctx.membership.id,
    },
  });

  revalidatePlanningPaths();
}

export async function deletePlanningNote(id: string) {
  const ctx = await requirePermission("schedule.edit");
  await prisma.planningNote.deleteMany({ where: { id, establishmentId: ctx.establishment.id } });
  revalidatePlanningPaths();
}


const StaffingRequirementSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  serviceId: z.string().min(1),
  position: z.enum(STAFFABLE_POSITIONS as [ShiftPosition, ...ShiftPosition[]]),
  requiredCount: z.number().int().min(0).max(20),
});

/// Combien de monde il faut à un (jour, service, poste) donné — la cible que le
/// générateur essaie d'atteindre (voir generateWeekSchedule). Une valeur à 0 supprime le
/// besoin plutôt que de laisser une ligne à 0 traîner en base.
export async function setStaffingRequirement(input: z.infer<typeof StaffingRequirementSchema>) {
  const ctx = await requirePermission("schedule.edit");
  const data = StaffingRequirementSchema.parse(input);

  const service = await prisma.serviceDefinition.findFirst({ where: { id: data.serviceId, establishmentId: ctx.establishment.id } });
  if (!service) throw new Error("Service introuvable.");

  if (data.requiredCount === 0) {
    await prisma.staffingRequirement.deleteMany({
      where: { establishmentId: ctx.establishment.id, dayOfWeek: data.dayOfWeek, serviceId: data.serviceId, position: data.position },
    });
  } else {
    await prisma.staffingRequirement.upsert({
      where: {
        establishmentId_dayOfWeek_serviceId_position: {
          establishmentId: ctx.establishment.id,
          dayOfWeek: data.dayOfWeek,
          serviceId: data.serviceId,
          position: data.position,
        },
      },
      update: { requiredCount: data.requiredCount },
      create: {
        establishmentId: ctx.establishment.id,
        dayOfWeek: data.dayOfWeek,
        serviceId: data.serviceId,
        position: data.position,
        requiredCount: data.requiredCount,
      },
    });
  }

  revalidatePlanningPaths();
}

/// Propose un horaire pour la semaine donnée à partir des besoins en personnel
/// déclarés (StaffingRequirement) — voir generateScheduleAssignments (compute.ts) pour
/// l'algorithme. Ne touche jamais aux créneaux déjà pourvus à la main : ne remplit que
/// ce qui manque, sans jamais recréer ni déplacer un shift existant. Les shifts créés
/// arrivent en statut "planned" (brouillon) : invisibles de l'équipe (voir
/// getWeekPlanning/getMyDashboard, qui excluent "planned" pour qui n'a pas
/// schedule.edit) tant que publishWeekSchedule n'a pas été appelée.
export async function generateWeekSchedule(weekStart: string) {
  const ctx = await requirePermission("schedule.edit");
  const establishmentId = ctx.establishment.id;
  const start = new Date(`${weekStart}T00:00:00`);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(days[6]);

  const [memberships, services, requirements, existingShifts, availabilities, timeOffs, targetRules] = await Promise.all([
    prisma.membership.findMany({ where: { establishmentId, status: "active" } }),
    prisma.serviceDefinition.findMany({ where: { establishmentId } }),
    prisma.staffingRequirement.findMany({ where: { establishmentId, requiredCount: { gt: 0 } } }),
    prisma.shift.findMany({ where: { establishmentId, date: { gte: rangeStart, lte: rangeEnd }, status: { not: "cancelled" } } }),
    prisma.availability.findMany({ where: { establishmentId } }),
    prisma.timeOffRequest.findMany({
      where: { establishmentId, status: "approved", startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
    }),
    prisma.schedulingRule.findMany({ where: { establishmentId, type: TARGET_SHIFTS_RULE_TYPE } }),
  ]);

  const targetByMembership = new Map<string, number>();
  for (const rule of targetRules) {
    if (!rule.membershipId) continue;
    try {
      const params = JSON.parse(rule.params) as { count?: number };
      if (typeof params.count === "number" && params.count > 0) targetByMembership.set(rule.membershipId, params.count);
    } catch {
      // ignore une règle mal formée — pas d'objectif pour cette personne
    }
  }

  const VALID_POSITIONS = new Set<string>(STAFFABLE_POSITIONS);
  const generatorMembers: GeneratorMember[] = memberships.map((m) => ({
    membershipId: m.id,
    employmentType: m.employmentType === "flexijob" ? "flexijob" : "fixe",
    positions: (m.skills ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is ShiftPosition => VALID_POSITIONS.has(s)),
    weeklyTarget: targetByMembership.get(m.id) ?? 1,
  }));

  const availabilitiesByMember = new Map<string, AvailabilityRow[]>();
  for (const a of availabilities) {
    const list = availabilitiesByMember.get(a.membershipId) ?? [];
    list.push({
      dayOfWeek: a.dayOfWeek,
      kind: a.kind as AvailabilityRow["kind"],
      startTime: a.startTime,
      endTime: a.endTime,
      serviceId: a.serviceId,
      date: a.date ? toDateKey(a.date) : null,
    });
    availabilitiesByMember.set(a.membershipId, list);
  }

  const absentOn = new Map<string, Set<string>>();
  for (const d of days) {
    const dateKey = toDateKey(d);
    const dStart = startOfDay(d);
    const dEnd = endOfDay(d);
    const set = new Set<string>();
    for (const t of timeOffs) {
      if (t.startDate <= dEnd && t.endDate >= dStart) set.add(t.membershipId);
    }
    absentOn.set(dateKey, set);
  }

  const requirementByKey = new Map<string, number>();
  for (const r of requirements) requirementByKey.set(`${r.dayOfWeek}|${r.serviceId}|${r.position}`, r.requiredCount);

  const existingCountBySlot = new Map<string, number>();
  const existingShiftsByMember: Record<string, { date: string; startTime: string; endTime: string }[]> = {};
  const existingCountByMember: Record<string, number> = {};
  for (const s of existingShifts) {
    const dateKey = toDateKey(s.date);
    const slotKey = `${dateKey}|${s.serviceId ?? ""}|${s.position}`;
    existingCountBySlot.set(slotKey, (existingCountBySlot.get(slotKey) ?? 0) + 1);
    (existingShiftsByMember[s.membershipId] ??= []).push({ date: dateKey, startTime: s.startTime, endTime: s.endTime });
    existingCountByMember[s.membershipId] = (existingCountByMember[s.membershipId] ?? 0) + 1;
  }

  const slots: GeneratorSlot[] = [];
  for (const d of days) {
    const dayOfWeek = isoWeekday(d);
    const dateKey = toDateKey(d);
    const servicesToday = services.filter((s) => s.daysOfWeek.split(",").map(Number).includes(dayOfWeek));
    for (const service of servicesToday) {
      for (const position of STAFFABLE_POSITIONS) {
        const required = requirementByKey.get(`${dayOfWeek}|${service.id}|${position}`) ?? 0;
        if (required <= 0) continue;
        const alreadyFilled = existingCountBySlot.get(`${dateKey}|${service.id}|${position}`) ?? 0;
        slots.push({
          date: dateKey,
          dayOfWeek,
          serviceId: service.id,
          startTime: service.startTime,
          endTime: service.endTime,
          position,
          required,
          alreadyFilled,
        });
      }
    }
  }

  const isEligible = (membershipId: string, slot: GeneratorSlot) => {
    if (absentOn.get(slot.date)?.has(membershipId)) return false;
    const rows = occurrenceAvailabilities(availabilitiesByMember.get(membershipId) ?? [], slot.dayOfWeek, slot.date);
    return isGeneratorEligible({ startTime: slot.startTime, endTime: slot.endTime, serviceId: slot.serviceId }, rows);
  };

  const assignments = generateScheduleAssignments({
    members: generatorMembers,
    slots,
    isEligible,
    existingShiftsByMember,
    existingCountByMember,
  });

  if (assignments.length > 0) {
    await prisma.shift.createMany({
      data: assignments.map((a) => ({
        establishmentId,
        membershipId: a.membershipId,
        serviceId: a.serviceId,
        date: new Date(`${a.date}T00:00:00`),
        startTime: a.startTime,
        endTime: a.endTime,
        position: a.position,
        status: "planned",
        source: "auto_generated",
      })),
    });
    revalidatePlanningPaths();
  }

  return { created: assignments.length };
}

/// Rend visible à l'équipe tout ce qui a été généré (ou créé manuellement en brouillon)
/// sur la semaine donnée — jusque-là invisible pour qui n'a pas schedule.edit (voir
/// getWeekPlanning/getMyDashboard). Notifie chaque personne concernée, comme pour un
/// shift créé à la main.
export async function publishWeekSchedule(weekStart: string) {
  const ctx = await requirePermission("schedule.edit");
  const start = new Date(`${weekStart}T00:00:00`);
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(addDays(start, 6));

  const draftShifts = await prisma.shift.findMany({
    where: { establishmentId: ctx.establishment.id, date: { gte: rangeStart, lte: rangeEnd }, status: "planned" },
  });
  if (draftShifts.length === 0) throw new Error("Aucun brouillon à publier sur cette semaine.");

  await prisma.shift.updateMany({
    where: { id: { in: draftShifts.map((s) => s.id) } },
    data: { status: "published" },
  });

  for (const s of draftShifts) {
    await notifyMember({
      establishmentId: ctx.establishment.id,
      membershipId: s.membershipId,
      type: "shift_changed",
      severity: "urgent",
      title: "Un nouveau service vous a été attribué",
      body: `${formatShiftDayLabel(s.date)} · ${s.startTime}–${s.endTime}`,
      linkHref: "/mon-espace",
    });
  }

  revalidatePlanningPaths();
  return draftShifts.length;
}

const CoverageRequestSchema = z.object({
  membershipId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().min(1).nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  position: z.enum(STAFFABLE_POSITIONS as [ShiftPosition, ...ShiftPosition[]]),
});

/// Demande ciblée à UNE personne qui n'est pas planifiée ce créneau-là ("tu peux faire
/// jeudi soir ?") — jamais une assignation directe : ça crée une CoverageRequest, pas un
/// Shift. La personne décide elle-même (voir respondToCoverageRequest) ; rien n'apparaît
/// sur son planning tant qu'elle n'a pas dit oui.
export async function requestCoverage(input: z.infer<typeof CoverageRequestSchema>) {
  const ctx = await requirePermission("schedule.edit");
  const data = CoverageRequestSchema.parse(input);

  const membership = await prisma.membership.findFirst({
    where: { id: data.membershipId, establishmentId: ctx.establishment.id, status: "active" },
  });
  if (!membership) throw new Error("Employé introuvable.");

  if (data.serviceId) {
    const service = await prisma.serviceDefinition.findFirst({ where: { id: data.serviceId, establishmentId: ctx.establishment.id } });
    if (!service) throw new Error("Service introuvable.");
  }

  const date = new Date(`${data.date}T00:00:00`);
  const existingPending = await prisma.coverageRequest.findFirst({
    where: { establishmentId: ctx.establishment.id, membershipId: data.membershipId, date, startTime: data.startTime, endTime: data.endTime, status: "pending" },
  });
  if (existingPending) throw new Error("Une demande est déjà en attente pour cette personne sur ce créneau.");

  await prisma.coverageRequest.create({
    data: {
      establishmentId: ctx.establishment.id,
      membershipId: data.membershipId,
      requestedById: ctx.membership.id,
      date,
      serviceId: data.serviceId,
      startTime: data.startTime,
      endTime: data.endTime,
      position: data.position,
    },
  });

  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: data.membershipId,
    type: "coverage_requested",
    severity: "important",
    title: "Le patron vous demande un renfort",
    body: `${formatShiftDayLabel(date)} · ${data.startTime}–${data.endTime}`,
    linkHref: "/mon-espace",
  });

  revalidatePlanningPaths();
  revalidatePath("/mon-espace");
}

/// La personne sollicitée répond — jamais pour un tiers (le membershipId vient du
/// contexte, pas d'un paramètre). "Oui" crée le shift à ce moment précis seulement ;
/// "non" ne crée rien. Le manager qui a demandé est notifié dans les deux cas : un
/// silence serait pire qu'un refus.
export async function respondToCoverageRequest(requestId: string, accept: boolean) {
  const ctx = await getCurrentContext();

  const request = await prisma.coverageRequest.findFirst({
    where: { id: requestId, establishmentId: ctx.establishment.id, membershipId: ctx.membership.id, status: "pending" },
  });
  if (!request) throw new Error("Demande introuvable.");

  if (accept) {
    await prisma.shift.create({
      data: {
        establishmentId: ctx.establishment.id,
        membershipId: ctx.membership.id,
        serviceId: request.serviceId,
        date: request.date,
        startTime: request.startTime,
        endTime: request.endTime,
        position: request.position,
        status: "published",
        source: "manual",
      },
    });
  }

  await prisma.coverageRequest.update({ where: { id: requestId }, data: { status: accept ? "accepted" : "declined" } });

  const memberName = `${ctx.user.firstName} ${ctx.user.lastName}`;
  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: request.requestedById,
    type: accept ? "coverage_accepted" : "coverage_declined",
    severity: accept ? "watch" : "important",
    title: accept ? `${memberName} peut faire le renfort demandé` : `${memberName} ne peut pas faire le renfort demandé`,
    body: `${formatShiftDayLabel(request.date)} · ${request.startTime}–${request.endTime}`,
    linkHref: "/planning",
  });

  revalidatePlanningPaths();
  revalidatePath("/mon-espace");
}
