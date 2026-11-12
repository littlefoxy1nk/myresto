import { prisma } from "@/lib/prisma";
import { provisionSystemRoles } from "@/lib/provision-establishment";
import { serviceLabel } from "@/lib/service-label";

export type NewEstablishment = {
  establishmentName: string;
  establishmentType: string;
  tableCount: number;
  openTime: string;
  closeTime: string;
  owner: {
    firstName: string;
    lastName: string;
    email: string;
    /// null : le compte existe mais personne ne peut encore s'y connecter ; le patron choisit son mot de passe via un lien d'invitation.
    passwordHash: string | null;
  };
};

/// Crée un établissement prêt à servir : son entreprise, ses rôles, son propriétaire, un premier service, une salle et ses tables.
/// Utilisé par l'inscription d'un restaurateur ET par l'espace équipe MYRESTO (qui crée l'établissement d'un client).
/// En cas d'échec en cours de route, tout ce qui vient d'être créé est retiré : pas de compte fantôme à moitié fait.
export async function createEstablishmentWithOwner(input: NewEstablishment): Promise<{ companyId: string; establishmentId: string; ownerUserId: string }> {
  let companyId: string | null = null;
  try {
    const company = await prisma.company.create({ data: { name: input.establishmentName } });
    companyId = company.id;
    const establishment = await prisma.establishment.create({
      data: { companyId: company.id, name: input.establishmentName, type: input.establishmentType, onboardedAt: new Date() },
    });

    const roleIdByKey = await provisionSystemRoles(establishment.id);
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: input.owner.email,
        passwordHash: input.owner.passwordHash,
        firstName: input.owner.firstName,
        lastName: input.owner.lastName,
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, establishmentId: establishment.id, roleId: roleIdByKey.get("OWNER")!, jobTitle: "Propriétaire" },
    });

    await prisma.serviceDefinition.create({
      data: {
        establishmentId: establishment.id,
        name: serviceLabel(input.openTime, input.closeTime),
        startTime: input.openTime,
        endTime: input.closeTime,
        daysOfWeek: "1,2,3,4,5,6,7",
      },
    });

    const zone = await prisma.zone.create({ data: { establishmentId: establishment.id, name: "Salle", sortOrder: 0 } });
    const perRow = 5;
    for (let i = 1; i <= input.tableCount; i++) {
      await prisma.restaurantTable.create({
        data: {
          establishmentId: establishment.id,
          zoneId: zone.id,
          label: `T${i}`,
          capacity: 4,
          posX: ((i - 1) % perRow) * 100 + 40,
          posY: Math.floor((i - 1) / perRow) * 100 + 40,
        },
      });
    }
    return { companyId: company.id, establishmentId: establishment.id, ownerUserId: user.id };
  } catch (error) {
    if (companyId) await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    throw error;
  }
}
