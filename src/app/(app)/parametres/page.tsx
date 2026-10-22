import { Fragment } from "react";
import { Check, Download, LogOut } from "lucide-react";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import { PERMISSIONS } from "@/lib/permissions";
import { logout } from "@/lib/actions/auth-actions";
import { parseAvatar } from "@/lib/avatar";
import { parseMuted, visibleNotificationCategories } from "@/lib/notification-preferences";
import { InstallAppCard } from "@/components/pwa/install-app";
import { isOwner } from "@/lib/account-deletion";
import { CloseEstablishmentCard } from "@/modules/settings/components/close-establishment-card";
import { ServicesCard } from "@/modules/settings/components/services-card";
import { ReviewLinksCard } from "@/modules/settings/components/review-links-card";
import { OnlineBookingCard } from "@/modules/settings/components/online-booking-card";
import { ModulesCard } from "@/modules/settings/components/modules-card";
import { AvatarEditor } from "@/modules/settings/components/avatar-editor";
import { NotificationPreferencesCard } from "@/modules/settings/components/notification-preferences-card";
import { ContactForm } from "@/modules/settings/components/contact-form";
import { SettingsTabs } from "@/modules/settings/components/settings-tabs";

const CATEGORY_LABELS: Record<string, string> = {
  reservations: "Réservations & salle",
  staff: "Équipe & planning",
  finance: "Finances",
  inventory: "Stock",
  crm: "Clients",
  marketing: "Communication",
  settings: "Paramètres",
};

export default async function ParametresPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await getCurrentContext();
  const canManage = ctx.can("settings.manage");

  // Les réglages de l'établissement sont réservés à qui gère les paramètres ; le reste est personnel.
  const groups = [
    ...(canManage
      ? [
          {
            label: "Établissement",
            tabs: [
              { key: "etablissement", label: "Mon établissement" },
              { key: "fonctionnalites", label: "Fonctionnalités" },
              { key: "droits", label: "Droits d'accès" },
              ...(isOwner(ctx) ? [{ key: "donnees", label: "Mes données" }] : []),
            ],
          },
        ]
      : []),
    {
      label: "Mon compte",
      tabs: [
        { key: "profil", label: "Mon profil" },
        { key: "notifications", label: "Notifications" },
        { key: "aide", label: "Aide et contact" },
      ],
    },
  ];
  const allowed = groups.flatMap((g) => g.tabs.map((t) => t.key));
  const { tab: requested } = await searchParams;
  const active = requested && allowed.includes(requested) ? requested : allowed[0];

  return (
    <div className="stagger mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {ctx.establishment.name}
          {ctx.establishment.isDemo && <Badge variant="accent">Données de démonstration</Badge>}
        </p>
      </div>

      <SettingsTabs groups={groups} active={active} />

      {active === "etablissement" && <EstablishmentTab ctx={ctx} />}
      {active === "fonctionnalites" && (
        <Card>
          <CardHeader>
            <CardTitle>Fonctionnalités</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choisis ce qui s&apos;affiche dans l&apos;appli. Une fonctionnalité dont tu n&apos;as pas besoin (le stock, la
              communication…) peut être désactivée pour ne pas encombrer l&apos;équipe.
            </p>
          </CardHeader>
          <CardContent>
            <ModulesCard disabledModules={ctx.establishment.disabledModules} />
          </CardContent>
        </Card>
      )}
      {active === "droits" && <RightsTab establishmentId={ctx.establishment.id} />}
      {active === "donnees" && isOwner(ctx) && <CloseEstablishmentCard establishmentName={ctx.establishment.name} />}

      {active === "profil" && (
        <>
          <InstallAppCard />
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <AvatarFigure config={parseAvatar(ctx.user.avatarJson, ctx.user.id)} size={48} />
                <div>
                  <p className="text-sm font-medium">
                    {ctx.user.firstName} {ctx.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ctx.membership.role.label} · {ctx.user.email ?? ctx.user.username}
                  </p>
                </div>
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
              <CardTitle>Mon bonhomme</CardTitle>
              <p className="text-sm text-muted-foreground">Compose-le à ton image : il s&apos;affiche à côté de ton nom dans l&apos;appli.</p>
            </CardHeader>
            <CardContent>
              <AvatarEditor initial={parseAvatar(ctx.user.avatarJson, ctx.user.id)} />
            </CardContent>
          </Card>
        </>
      )}

      {active === "notifications" && (
        <Card>
          <CardHeader>
            <CardTitle>Mes notifications</CardTitle>
            <p className="text-sm text-muted-foreground">Choisis celles que tu veux recevoir. Tu ne vois ici que ce qui te concerne selon tes accès.</p>
          </CardHeader>
          <CardContent>
            <NotificationPreferencesCard
              categories={visibleNotificationCategories(ctx.can).map((c) => ({ key: c.key, label: c.label, description: c.description }))}
              muted={[...parseMuted(ctx.membership.mutedNotificationCategories)]}
            />
          </CardContent>
        </Card>
      )}

      {active === "aide" && (
        <Card>
          <CardHeader>
            <CardTitle>Aide et contact</CardTitle>
            <p className="text-sm text-muted-foreground">Un souci, une question, une idée ? Écris-nous : ton message est envoyé par email à l&apos;assistance.</p>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function EstablishmentTab({ ctx }: { ctx: Awaited<ReturnType<typeof getCurrentContext>> }) {
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

  return (
    <>
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
          <OnlineBookingCard slug={ctx.establishment.bookingSlug} enabled={ctx.establishment.onlineBookingEnabled} />
        </CardContent>
      </Card>

      <Card id="avis">
        <CardHeader>
          <CardTitle>Avis clients</CardTitle>
          <p className="text-sm text-muted-foreground">
            Les liens glissés dans le premier mail aux clients abonnés, pour qu&apos;ils laissent un avis après leur venue.
          </p>
        </CardHeader>
        <CardContent>
          <ReviewLinksCard google={ctx.establishment.googleReviewUrl} tripadvisor={ctx.establishment.tripadvisorReviewUrl} />
        </CardContent>
      </Card>
    </>
  );
}

async function RightsTab({ establishmentId }: { establishmentId: string }) {
  const roles = await prisma.role.findMany({
    where: { establishmentId },
    include: { permissions: { include: { permission: true } } },
    orderBy: { createdAt: "asc" },
  });
  const categories = Array.from(new Set(PERMISSIONS.map((p) => p.category)));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Droits d&apos;accès</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Chaque rôle (le poste de la personne) décide de ce qu&apos;elle voit et peut faire dans l&apos;appli. Une coche =
              le rôle a ce droit. Le PDF reprend le tableau et explique chaque droit en une phrase.
            </p>
          </div>
          <Button asChild size="sm">
            <a href="/api/rights-pdf">
              <Download size={14} aria-hidden="true" />
              Télécharger le PDF
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">Droit</th>
              {roles.map((role) => (
                <th key={role.id} className="border-b border-border px-3 py-2 text-center font-medium text-muted-foreground">
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <Fragment key={category}>
                <tr>
                  <td colSpan={roles.length + 1} className="bg-muted px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                          {has && <Check size={15} className="mx-auto text-good" aria-label="Oui" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-muted-foreground">La création de rôles personnalisés arrive dans une prochaine mise à jour.</p>
      </CardContent>
    </Card>
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
