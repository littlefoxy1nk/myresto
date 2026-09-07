"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentContext, requirePermission, ForbiddenError } from "@/lib/current-context";

export type ZoneAssignments = {
  zoneId: string;
  zoneName: string;
  members: { membershipId: string; assignmentId: string; firstName: string; lastName: string }[];
};

export type AssignableMember = { membershipId: string; firstName: string; lastName: string; jobTitle: string | null };

export type ZoneAssignmentsResult = {
  zones: ZoneAssignments[];
  assignableMembers: AssignableMember[];
  canEdit: boolean;
};

/// Qui couvre quoi "en ce moment" — lecture ouverte à quiconque pilote le service
/// (service.run), pas seulement à ceux qui ont le droit de le modifier (staff.assign).
/// C'est exactement ce que le Mode Service doit pouvoir afficher sans exposer les
/// fonctions de gestion RH complètes.
export async function getZoneAssignments(): Promise<ZoneAssignmentsResult> {
  const ctx = await getCurrentContext();
  if (!ctx.can("service.run") && !ctx.can("staff.view")) {
    throw new ForbiddenError("service.run ou staff.view");
  }

  const [zones, assignments, memberships] = await Promise.all([
    prisma.zone.findMany({ where: { establishmentId: ctx.establishment.id }, orderBy: { sortOrder: "asc" } }),
    prisma.staffAssignment.findMany({
      where: { establishmentId: ctx.establishment.id, tableId: null },
      include: { membership: { include: { user: true } } },
    }),
    prisma.membership.findMany({
      where: { establishmentId: ctx.establishment.id, status: "active" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const byZone = new Map<string, ZoneAssignments["members"]>();
  for (const a of assignments) {
    const list = byZone.get(a.zoneId) ?? [];
    list.push({
      membershipId: a.membershipId,
      assignmentId: a.id,
      firstName: a.membership.user.firstName,
      lastName: a.membership.user.lastName,
    });
    byZone.set(a.zoneId, list);
  }

  return {
    zones: zones.map((z) => ({ zoneId: z.id, zoneName: z.name, members: byZone.get(z.id) ?? [] })),
    assignableMembers: memberships.map((m) => ({
      membershipId: m.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      jobTitle: m.jobTitle,
    })),
    canEdit: ctx.can("staff.assign"),
  };
}

const AssignSchema = z.object({
  membershipId: z.string().min(1),
  zoneId: z.string().min(1),
});

export async function assignStaffToZone(input: z.infer<typeof AssignSchema>) {
  const ctx = await requirePermission("staff.assign");
  const data = AssignSchema.parse(input);

  const [membership, zone] = await Promise.all([
    prisma.membership.findFirst({ where: { id: data.membershipId, establishmentId: ctx.establishment.id } }),
    prisma.zone.findFirst({ where: { id: data.zoneId, establishmentId: ctx.establishment.id } }),
  ]);
  if (!membership) throw new Error("Membre introuvable.");
  if (!zone) throw new Error("Zone introuvable.");

  const existing = await prisma.staffAssignment.findFirst({
    where: { membershipId: data.membershipId, zoneId: data.zoneId, tableId: null },
  });
  if (existing) return existing;

  const assignment = await prisma.staffAssignment.create({
    data: { establishmentId: ctx.establishment.id, membershipId: data.membershipId, zoneId: data.zoneId },
  });

  revalidatePath("/equipe");
  revalidatePath("/service");
  return assignment;
}

export async function removeStaffAssignment(assignmentId: string) {
  const ctx = await requirePermission("staff.assign");

  const assignment = await prisma.staffAssignment.findFirst({
    where: { id: assignmentId, establishmentId: ctx.establishment.id },
  });
  if (!assignment) throw new Error("Affectation introuvable.");

  await prisma.staffAssignment.delete({ where: { id: assignmentId } });

  revalidatePath("/equipe");
  revalidatePath("/service");
}
