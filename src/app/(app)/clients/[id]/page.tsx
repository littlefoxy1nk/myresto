import { DeleteCustomerButton } from "@/modules/customers/components/delete-customer-button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import Link from "next/link";
import { requireModule } from "@/lib/module-guard";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { getCustomerDetail } from "@/modules/customers/server/queries";
import { CustomerProfileForm } from "@/modules/customers/components/customer-profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RESERVATION_STATUS_LABEL, RESERVATION_STATUS_VARIANT } from "@/modules/reservations/status";

function formatDate(d: string) {
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${d}T00:00:00`)
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentContext();
  requireModule(ctx, "crm");
  if (!ctx.can("crm.view")) redirect("/aujourdhui");

  const { id } = await params;
  const customer = await getCustomerDetail(ctx.establishment.id, id);
  if (!customer) notFound();

  const tables = await prisma.restaurantTable.findMany({
    where: { establishmentId: ctx.establishment.id },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });

  return (
    <div className="stagger mx-auto max-w-3xl space-y-6">
      <Link href="/clients" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} aria-hidden="true" />
        Clients
      </Link>

      <div className="flex items-center gap-4">
        <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} className="h-16 w-16 text-xl" />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight">
            {customer.firstName} {customer.lastName}
            {customer.newsletterConsent && <Badge variant="good">Newsletter</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[customer.phone, customer.email].filter(Boolean).join(" · ") || "Pas de coordonnées"}
            {customer.birthday && ` · Né(e) le ${formatDate(customer.birthday)}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-semibold">{customer.visitCount}</p>
          <p className="text-xs text-muted-foreground">Visite{customer.visitCount > 1 ? "s" : ""}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-semibold">{customer.noShowCount}</p>
          <p className="text-xs text-muted-foreground">No-show{customer.noShowCount > 1 ? "s" : ""}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-semibold">{customer.favoriteTableLabel ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Table préférée</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fiche client</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {ctx.can("crm.manage") ? (
            <CustomerProfileForm
              customerId={customer.id}
              initial={{
                preferences: customer.preferences,
                allergies: customer.allergies,
                notes: customer.notes,
                favoriteTableId: customer.favoriteTableId,
                phone: customer.phone,
                birthday: customer.birthday,
              }}
              tables={tables}
            />
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Préférences :</span> {customer.preferences || "—"}</p>
              <p><span className="font-medium">Allergies :</span> {customer.allergies || "—"}</p>
              <p><span className="font-medium">Notes :</span> {customer.notes || "—"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {ctx.can("crm.manage") && (
        <div className="flex justify-end">
          <DeleteCustomerButton customerId={customer.id} name={`${customer.firstName} ${customer.lastName}`} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historique des réservations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {customer.history.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2.5 text-sm">
              <div>
                <span className="font-medium">{formatDate(h.date)}</span>{" "}
                <span className="text-muted-foreground">
                  · {h.time} · {h.partySize} pers.{h.tableLabels.length > 0 ? ` · ${h.tableLabels.join(" + ")}` : ""}
                </span>
              </div>
              <Badge variant={RESERVATION_STATUS_VARIANT[h.status]}>{RESERVATION_STATUS_LABEL[h.status]}</Badge>
            </div>
          ))}
          {customer.history.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune réservation pour le moment.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
