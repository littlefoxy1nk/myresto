import "dotenv/config";
import bcrypt from "bcryptjs";
import { addDays, nextSaturday, setHours, setMinutes, startOfDay, startOfWeek } from "date-fns";
import { prisma } from "../src/lib/prisma";
import { provisionSystemRoles } from "../src/lib/provision-establishment";

async function main() {
  // Repartir propre pour la démo
  const existing = await prisma.company.findFirst({ where: { name: "Le Petit Comptoir Demo" } });
  if (existing) {
    await prisma.establishment.deleteMany({ where: { companyId: existing.id } });
    await prisma.user.deleteMany({ where: { companyId: existing.id } });
    await prisma.company.delete({ where: { id: existing.id } });
  }

  const company = await prisma.company.create({
    data: { name: "Le Petit Comptoir Demo" },
  });

  const establishment = await prisma.establishment.create({
    data: {
      companyId: company.id,
      name: "Le Petit Comptoir",
      type: "restaurant",
      // isDemo pilote un badge "Démo" affiché dans l'UI (sidebar, tableau de bord) —
      // séparé du nom pour ne jamais dépendre d'une troncature d'affichage.
      isDemo: true,
      address: "12 Rue de la Bourse",
      city: "Bruxelles",
      postalCode: "1000",
      country: "BE",
      onboardedAt: new Date(),
    },
  });

  // Rôles système + permissions par défaut (même provisioning que l'onboarding réel).
  const roleByKey = await provisionSystemRoles(establishment.id);

  // 3. Services
  const lunch = await prisma.serviceDefinition.create({
    data: {
      establishmentId: establishment.id,
      name: "Déjeuner",
      startTime: "12:00",
      endTime: "14:30",
      daysOfWeek: "1,2,3,4,5,6",
    },
  });
  const dinner = await prisma.serviceDefinition.create({
    data: {
      establishmentId: establishment.id,
      name: "Dîner",
      startTime: "19:00",
      endTime: "23:00",
      daysOfWeek: "1,2,3,4,5,6,7",
    },
  });

  // 4. Plan de salle
  const salle = await prisma.zone.create({ data: { establishmentId: establishment.id, name: "Salle", type: "salle", sortOrder: 0 } });
  const terrasse = await prisma.zone.create({ data: { establishmentId: establishment.id, name: "Terrasse", type: "terrasse", sortOrder: 1 } });
  const bar = await prisma.zone.create({ data: { establishmentId: establishment.id, name: "Bar", type: "bar", sortOrder: 2 } });

  const tableDefs = [
    { zone: salle, label: "T1", capacity: 2, shape: "round", x: 40, y: 40 },
    { zone: salle, label: "T2", capacity: 2, shape: "round", x: 140, y: 40 },
    { zone: salle, label: "T3", capacity: 4, shape: "square", x: 40, y: 140 },
    { zone: salle, label: "T4", capacity: 4, shape: "square", x: 140, y: 140 },
    { zone: salle, label: "T5", capacity: 4, shape: "square", x: 240, y: 140 },
    { zone: salle, label: "T12", capacity: 4, shape: "rect", x: 40, y: 240 },
    { zone: salle, label: "T13", capacity: 4, shape: "rect", x: 140, y: 240 },
    { zone: terrasse, label: "TR1", capacity: 4, shape: "square", x: 40, y: 40 },
    { zone: terrasse, label: "TR2", capacity: 6, shape: "rect", x: 160, y: 40 },
    { zone: bar, label: "B1", capacity: 2, shape: "round", x: 40, y: 40 },
  ] as const;
  const tables = [];
  for (const t of tableDefs) {
    const table = await prisma.restaurantTable.create({
      data: {
        establishmentId: establishment.id,
        zoneId: t.zone.id,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape,
        posX: t.x,
        posY: t.y,
      },
    });
    tables.push(table);
  }

  // T12 + T13 sont physiquement poussées ensemble pour les grandes tablées — c'est
  // cette unité que "Groupe Dupuis" (8 pers.) occupe plus bas.
  const t12t13Group = await prisma.tableGroup.create({
    data: { establishmentId: establishment.id, combinedCapacity: 8, isPermanent: true },
  });
  await prisma.tableGroupMember.createMany({
    data: [tables[5], tables[6]].map((t) => ({ groupId: t12t13Group.id, tableId: t.id })),
  });

  // 5. Utilisateurs / équipe
  const passwordHash = await bcrypt.hash("demo1234", 10);

  async function makeEmployee(opts: {
    firstName: string;
    lastName: string;
    email: string;
    roleKey: string;
    jobTitle: string;
    weeklyHoursTarget?: number;
    maxShiftsPerWeek?: number;
    skills?: string;
  }) {
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: opts.email,
        passwordHash,
        firstName: opts.firstName,
        lastName: opts.lastName,
      },
    });
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        establishmentId: establishment.id,
        roleId: roleByKey.get(opts.roleKey)!,
        jobTitle: opts.jobTitle,
        weeklyHoursTarget: opts.weeklyHoursTarget ?? 38,
        maxShiftsPerWeek: opts.maxShiftsPerWeek ?? 5,
        skills: opts.skills,
        hiredAt: addDays(new Date(), -400),
      },
    });
    return { user, membership };
  }

  const owner = await makeEmployee({
    firstName: "Chloé",
    lastName: "Hamoir",
    email: "chloehamoir@gmail.com",
    roleKey: "OWNER",
    jobTitle: "Propriétaire",
  });
  const marc = await makeEmployee({
    firstName: "Marc",
    lastName: "Dubois",
    email: "marc@lepetitcomptoir.demo",
    roleKey: "MANAGER",
    jobTitle: "Gérant",
  });
  const julie = await makeEmployee({
    firstName: "Julie",
    lastName: "Renard",
    email: "julie@lepetitcomptoir.demo",
    roleKey: "FLOOR_STAFF",
    jobTitle: "Cheffe de rang",
    maxShiftsPerWeek: 5,
    skills: "salle,bar",
  });
  const paul = await makeEmployee({
    firstName: "Paul",
    lastName: "Lefebvre",
    email: "paul@lepetitcomptoir.demo",
    roleKey: "FLOOR_STAFF",
    jobTitle: "Serveur",
    maxShiftsPerWeek: 4,
    skills: "salle",
  });
  const sarah = await makeEmployee({
    firstName: "Sarah",
    lastName: "Peeters",
    email: "sarah@lepetitcomptoir.demo",
    roleKey: "FLOOR_STAFF",
    jobTitle: "Serveuse",
    maxShiftsPerWeek: 5,
    skills: "salle",
  });
  const thomas = await makeEmployee({
    firstName: "Thomas",
    lastName: "Willems",
    email: "thomas@lepetitcomptoir.demo",
    roleKey: "CHEF",
    jobTitle: "Chef de cuisine",
    skills: "cuisine",
  });
  const lea = await makeEmployee({
    firstName: "Léa",
    lastName: "Moreau",
    email: "lea@lepetitcomptoir.demo",
    roleKey: "BAR_STAFF",
    jobTitle: "Barmaid",
    skills: "bar",
  });

  // 6. Planning : aujourd'hui + samedi prochain
  const today = startOfDay(new Date());
  const saturday = nextSaturday(today);

  function atTime(day: Date, time: string) {
    const [h, m] = time.split(":").map(Number);
    return setMinutes(setHours(day, h), m);
  }

  // Ce soir : équipe normale, mais Paul est planifié alors qu'il a un congé approuvé le
  // même jour -> déclenche à la fois l'alerte d'absence d'Aujourd'hui et le conflit
  // "planifié mais absent" du Planning (Mission 5).
  await prisma.shift.create({
    data: {
      establishmentId: establishment.id, membershipId: marc.membership.id, serviceId: dinner.id,
      date: today, startTime: "18:30", endTime: "23:00", position: "direction", status: "published",
    },
  });
  await prisma.shift.create({
    data: {
      establishmentId: establishment.id, membershipId: paul.membership.id, serviceId: dinner.id,
      date: today, startTime: "19:00", endTime: "22:00", position: "salle", status: "published",
    },
  });
  await prisma.shift.create({
    data: {
      establishmentId: establishment.id, membershipId: julie.membership.id, serviceId: dinner.id,
      date: today, startTime: "18:30", endTime: "23:00", position: "salle", status: "published",
    },
  });
  await prisma.shift.create({
    data: {
      establishmentId: establishment.id, membershipId: sarah.membership.id, serviceId: dinner.id,
      date: today, startTime: "19:00", endTime: "22:30", position: "salle", status: "published",
    },
  });
  await prisma.shift.create({
    data: {
      establishmentId: establishment.id, membershipId: thomas.membership.id, serviceId: dinner.id,
      date: today, startTime: "18:00", endTime: "23:00", position: "cuisine", status: "published",
    },
  });
  await prisma.shift.create({
    data: {
      establishmentId: establishment.id, membershipId: lea.membership.id, serviceId: dinner.id,
      date: today, startTime: "18:30", endTime: "23:00", position: "bar", status: "published",
    },
  });

  await prisma.timeOffRequest.create({
    data: {
      establishmentId: establishment.id,
      membershipId: paul.membership.id,
      startDate: today,
      endDate: today,
      reason: "Empêchement personnel",
      status: "approved",
    },
  });

  // Julie n'est déclarée disponible qu'à partir de 19h ce jour-là, mais son shift
  // commence à 18h30 -> déclenche l'avertissement "hors disponibilité déclarée"
  // (Mission 6) sans qu'aucune donnée supplémentaire ne soit nécessaire.
  const todayIsoDay = today.getDay() === 0 ? 7 : today.getDay();
  await prisma.availability.create({
    data: {
      establishmentId: establishment.id,
      membershipId: julie.membership.id,
      dayOfWeek: todayIsoDay,
      kind: "preferred",
      startTime: "19:00",
      endTime: "23:30",
    },
  });

  // Paul a déjà son shift de ce soir ; on lui en ajoute 3 autres cette semaine pour
  // atteindre exactement sa limite hebdomadaire (4) -> déclenche l'avertissement
  // "limite hebdomadaire atteinte" (Mission 6).
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const paulExtraDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter((d) => d.getTime() !== today.getTime())
    .slice(0, 3);
  for (const day of paulExtraDays) {
    await prisma.shift.create({
      data: {
        establishmentId: establishment.id, membershipId: paul.membership.id,
        date: day, startTime: "11:30", endTime: "15:00", position: "salle", status: "published",
      },
    });
  }

  // Une demande en attente sur un jour où Sarah travaille déjà -> l'accepter pendant
  // les tests doit faire apparaître immédiatement le conflit "planifié mais absent"
  // dans le Planning, sans quoi la V1 des congés serait invisible tant que rien n'a
  // encore été traité par un manager.
  await prisma.timeOffRequest.create({
    data: {
      establishmentId: establishment.id,
      membershipId: sarah.membership.id,
      startDate: today,
      endDate: today,
      reason: "Rendez-vous médical",
      status: "pending",
    },
  });

  // Une seconde demande en attente, sur une autre personne et une autre période, pour
  // tester le refus sans toucher au planning de cette semaine.
  await prisma.timeOffRequest.create({
    data: {
      establishmentId: establishment.id,
      membershipId: thomas.membership.id,
      startDate: addDays(weekStart, 14),
      endDate: addDays(weekStart, 16),
      reason: "Congés payés",
      status: "pending",
    },
  });

  // Samedi : forte charge (145 couverts visés) avec un planning volontairement insuffisant
  for (const [m, pos, start, end] of [
    [marc, "direction", "18:30", "23:30"],
    [julie, "salle", "19:00", "22:00"],
    [thomas, "cuisine", "17:30", "23:30"],
    [lea, "bar", "18:30", "23:30"],
  ] as const) {
    await prisma.shift.create({
      data: {
        establishmentId: establishment.id, membershipId: m.membership.id, serviceId: dinner.id,
        date: saturday, startTime: start, endTime: end, position: pos, status: "published",
      },
    });
  }

  // 7. Réservations
  const reservationSeeds = [
    { name: "Famille Janssens", size: 4, time: "19:00", status: "confirmed", tables: [tables[2]] },
    { name: "Marie Petit", size: 2, time: "19:30", status: "new", tables: [tables[0]] },
    { name: "Antoine Simon", size: 2, time: "20:00", status: "new", tables: [tables[1]] },
    { name: "Groupe Dupuis", size: 8, time: "20:00", status: "confirmed", tables: [tables[5], tables[6]] },
    { name: "Sophie Leroy", size: 4, time: "20:30", status: "new", tables: [tables[3]] },
    { name: "Nicolas Bertrand", size: 2, time: "21:00", status: "confirmed", tables: [tables[9]] },
  ];
  for (const r of reservationSeeds) {
    const reservation = await prisma.reservation.create({
      data: {
        establishmentId: establishment.id,
        serviceId: dinner.id,
        customerName: r.name,
        partySize: r.size,
        date: today,
        time: r.time,
        status: r.status,
      },
    });
    for (const t of r.tables) {
      await prisma.reservationTable.create({ data: { reservationId: reservation.id, tableId: t.id } });
    }
    await prisma.reservationStatusEvent.create({
      data: { reservationId: reservation.id, status: r.status },
    });
  }

  // Samedi : 145 couverts prévus au total, répartis en réservations
  const saturdayParties = [2, 2, 4, 4, 6, 8, 2, 4, 4, 2, 6, 4, 8, 4, 2, 6, 4, 4, 2, 8, 4, 6, 4, 4, 2, 4, 2, 4];
  let idx = 0;
  for (const size of saturdayParties) {
    idx++;
    await prisma.reservation.create({
      data: {
        establishmentId: establishment.id,
        serviceId: dinner.id,
        customerName: `Réservation ${idx}`,
        partySize: size,
        date: saturday,
        time: idx % 2 === 0 ? "19:30" : "20:30",
        status: idx <= 3 ? "new" : "confirmed",
      },
    });
  }

  // 8. Clients CRM
  await prisma.customer.createMany({
    data: [
      {
        establishmentId: establishment.id, firstName: "Jean", lastName: "Moreau",
        phone: "+32470000001", visitCount: 12, totalSpentCents: 84000,
        lastVisitAt: addDays(new Date(), -120), notes: "Habitué, table préférée T4",
      },
      {
        establishmentId: establishment.id, firstName: "Amélie", lastName: "Fontaine",
        phone: "+32470000002", visitCount: 3, totalSpentCents: 15000,
        lastVisitAt: addDays(new Date(), -10),
      },
      {
        establishmentId: establishment.id, firstName: "Karim", lastName: "Bensaid",
        phone: "+32470000003", visitCount: 1, totalSpentCents: 4200,
        lastVisitAt: addDays(new Date(), -2),
      },
    ],
  });

  // 9. Stock — un produit en risque de rupture avant samedi
  const supplier = await prisma.supplier.create({
    data: { establishmentId: establishment.id, name: "Boucherie Centrale", contactEmail: "contact@boucherie-centrale.be" },
  });
  await prisma.product.create({
    data: {
      establishmentId: establishment.id,
      supplierId: supplier.id,
      name: "Filet de bœuf",
      category: "Viande",
      unit: "kg",
      currentStock: 12,
      reorderThreshold: 15,
      avgDailyUsage: 4,
      unitCostCents: 2800,
    },
  });
  await prisma.product.create({
    data: {
      establishmentId: establishment.id,
      supplierId: supplier.id,
      name: "Saumon frais",
      category: "Poisson",
      unit: "kg",
      currentStock: 30,
      reorderThreshold: 10,
      avgDailyUsage: 3,
      unitCostCents: 1900,
    },
  });

  // 10. Historique de service (mémoire opérationnelle)
  await prisma.serviceReport.create({
    data: {
      establishmentId: establishment.id,
      date: addDays(today, -7),
      serviceLabel: "Dîner",
      rating: "bad",
      issues: "understaffed,wait",
      covers: 112,
      note: "Vendredi chargé, retards en cuisine faute de personnel.",
    },
  });
  await prisma.serviceReport.create({
    data: {
      establishmentId: establishment.id,
      date: addDays(today, -3),
      serviceLabel: "Dîner",
      rating: "good",
      covers: 68,
    },
  });

  // 11. Chiffre d'affaires récent (pour les finances / insights)
  for (let i = 1; i <= 14; i++) {
    const day = addDays(today, -i);
    const isWeekend = [5, 6, 0].includes(day.getDay());
    const isTuesday = day.getDay() === 2;
    const covers = isWeekend ? 90 + (i % 5) * 4 : isTuesday ? 28 : 55 + (i % 4) * 3;
    const avgTicket = isTuesday ? 3200 : 4200;
    await prisma.revenueEntry.create({
      data: { establishmentId: establishment.id, date: day, amountCents: covers * avgTicket, covers },
    });
    await prisma.costEntry.create({
      data: {
        establishmentId: establishment.id, date: day, category: "labor",
        amountCents: Math.round(covers * avgTicket * (isTuesday ? 0.42 : 0.32)),
      },
    });
  }

  console.log("Seed terminé.");
  console.log(`Connexion démo : chloehamoir@gmail.com / demo1234`);
  console.log(`Établissement : ${establishment.name} (id: ${establishment.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
