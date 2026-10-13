import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/permissions";
import { logout } from "@/lib/actions/auth-actions";
import { Check, LogOut } from "lucide-react";
import { ServicesCard } from "@/modules/settings/components/services-card";
import { OnlineBookingCard } from "@/modules/settings/components/online-booking-card";

const CATEGORY_LABELS: Record<string, string> = {
  reservations: "Réservations & salle",
  staff: "Équipe & planning",
  finance: "Finances",
  inventory: "Stock",
  crm: "Clients",
  marketing: "Marketing",
  settings: "Paramètres",
};

export default async function ParametresPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("settings.manage")) redirect("/aujourdhui");

  const roles = await prisma.role.findMany({
    where: { establishmentId: ctx.establishment.id },
    include: { permissions: { include: { permission: true } } },
    orderBy: { createdAt: "asc" },
  });

  const services = (
    await prisma.serviceDefinition.findMany({
      where: { establishmentId: ctx.establishment.id },
      orderBy: { startTime: "asc" },
    })
  ).map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    days: s.daysOfWeek.split(",").map(Number),
  }));

  const categories = Array.from(new Set(PERMISSIONS.map((p) => p.category)));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {ctx.establishment.name}
          {ctx.establishment.isDemo && <Badge variant="accent">Données de démonstration</Badge>}
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">
              {ctx.user.firstName} {ctx.user.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{ctx.user.email ?? ctx.user.username}</p>
          </div>
          <form action={logout}>
            <Button type="submit" size="sm" variant="outline">
              <LogOut size={15} aria-hidden="true" />
              Se déconnecter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Établissement</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Info label="Nom" value={ctx.establishment.name} />
          <Info label="Type" value={ctx.establishment.type} />
          <Info label="Ville" value={ctx.establishment.city ?? "—"} />
          <Info label="Devise" value={ctx.establishment.currency} />
          <Info label="Fuseau horaire" value={ctx.establishment.timezone} />
        </CardContent>
      </Card>

      <Card id="services">
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <p className="text-sm text-muted-foreground">
            Les plages d&apos;accueil de ton établissement (ex : 12h, 18h, 20h30). Elles servent au planning, au plan de salle,
            aux réservations et à la page de réservation en ligne.
          </p>
        </CardHeader>
        <CardContent>
          <ServicesCard services={services} />
        </CardContent>
      </Card>

      <Card id="reservation-en-ligne">
        <CardHeader>
          <CardTitle>Réservation en ligne</CardTitle>
          <p className="text-sm text-muted-foreground">
            Un lien public à partager (site, Instagram, Google) : le client envoie une demande (nom, prénom, GSM
            obligatoires), tu es notifié, tu choisis la table et tu confirmes.
          </p>
        </CardHeader>
        <CardContent>
          <OnlineBookingCard
            slug={ctx.establishment.bookingSlug}
            enabled={ctx.establishment.onlineBookingEnabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rôles & permissions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble des droits par rôle, à titre informatif — la matrice n&apos;est pas modifiable ici.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">
                  Permission
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="border-b border-border px-3 py-2 text-center font-medium text-muted-foreground"
                  >
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <Fragment key={category}>
                  <tr>
                    <td
                      colSpan={roles.length + 1}
                      className="bg-muted px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {CATEGORY_LABELS[category] ?? category}
                    </td>
                  </tr>
                  {PERMISSIONS.filter((p) => p.category === category).map((perm) => (
                    <tr key={perm.key}>
                      <td className="border-b border-border px-3 py-2">{perm.label}</td>
                      {roles.map((role) => {
                        const has = role.permissions.some((rp) => rp.permission.key === perm.key);
                        return (
                          <td key={role.id} className="border-b border-border px-3 py-2 text-center">
                            {has && <Check size={15} className="mx-auto text-good" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            La création de rôles personnalisés arrive dans une prochaine mise à jour.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
