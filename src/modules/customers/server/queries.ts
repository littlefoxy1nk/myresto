import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { computeCustomerStats } from "@/modules/customers/compute";
import type { CustomerDetail, CustomerReservationHistoryItem, CustomerSummary } from "@/modules/customers/types";

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/// Liste des clients avec leurs statistiques dérivées de l'historique réel (voir
/// compute.ts) — jamais du compteur stocké sur Customer, pour éviter toute divergence.
export async function getCustomersList(establishmentId: string, search?: string): Promise<CustomerSummary[]> {
  const ctx = await getCurrentContext();
  if (!ctx.can("crm.view")) throw new ForbiddenError("crm.view");

  const customers = await prisma.customer.findMany({
    where: {
      establishmentId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    },
    include: { reservations: { select: { date: true, status: true } } },
  });

  const summaries: CustomerSummary[] = customers.map((c) => {
    const stats = computeCustomerStats(c.reservations.map((r) => ({ date: toDateKey(r.date), status: r.status })));
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      ...stats,
    };
  });

  return summaries.sort((a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));
}

export async function getCustomerDetail(establishmentId: string, customerId: string): Promise<CustomerDetail | null> {
  const ctx = await getCurrentContext();
  if (!ctx.can("crm.view")) throw new ForbiddenError("crm.view");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, establishmentId },
    include: {
      reservations: {
        include: { tables: { include: { table: true } } },
        orderBy: [{ date: "desc" }, { time: "desc" }],
      },
      favoriteTable: true,
    },
  });
  if (!customer) return null;

  const history: CustomerReservationHistoryItem[] = customer.reservations.map((r) => ({
    id: r.id,
    date: toDateKey(r.date),
    time: r.time,
    partySize: r.partySize,
    status: r.status,
    tableLabels: r.tables.map((t) => t.table.label),
  }));

  const stats = computeCustomerStats(history.map((h) => ({ date: h.date, status: h.status })));

  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
    birthday: customer.birthday ? toDateKey(customer.birthday) : null,
    preferences: customer.preferences,
    allergies: customer.allergies,
    notes: customer.notes,
    favoriteTableId: customer.favoriteTableId,
    favoriteTableLabel: customer.favoriteTable?.label ?? null,
    history,
    ...stats,
  };
}
