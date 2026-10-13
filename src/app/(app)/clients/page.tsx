import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getCustomersList } from "@/modules/customers/server/queries";
import { getNewsletterAudience } from "@/modules/newsletter/server/queries";
import { WelcomeMailButton } from "@/modules/newsletter/components/welcome-mail-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatDate(d: string) {
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${d}T00:00:00`)
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const ctx = await getCurrentContext();
  if (!ctx.can("crm.view")) redirect("/aujourdhui");

  const { q, filter } = await searchParams;
  const all = await getCustomersList(ctx.establishment.id, q);
  const onlyNewsletter = filter === "newsletter";
  const customers = onlyNewsletter ? all.filter((c) => c.newsletterConsent) : all;
  const subscriberCount = all.filter((c) => c.newsletterConsent).length;
  const audience = ctx.can("crm.manage") ? await getNewsletterAudience(ctx.establishment.id) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customers.length} client{customers.length > 1 ? "s" : ""}
            {onlyNewsletter ? " abonnés à la newsletter" : ` · ${subscriberCount} abonné${subscriberCount > 1 ? "s" : ""} à la newsletter`}
          </p>
        </div>
        {ctx.can("crm.manage") && (
          <WelcomeMailButton
            recipients={audience}
            restaurantName={ctx.establishment.name}
            googleUrl={ctx.establishment.googleReviewUrl}
            tripadvisorUrl={ctx.establishment.tripadvisorReviewUrl}
          />
        )}
      </div>

      <div className="flex gap-1.5">
        {[
          { label: "Tous", href: q ? `/clients?q=${encodeURIComponent(q)}` : "/clients", active: !onlyNewsletter },
          {
            label: "Newsletter",
            href: `/clients?filter=newsletter${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            active: onlyNewsletter,
          },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.href}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
              f.active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form className="flex gap-2">
        {onlyNewsletter && <input type="hidden" name="filter" value="newsletter" />}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Chercher par nom, téléphone, email…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </form>

      <div className="space-y-2">
        {customers.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`}>
            <Card className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "Pas de coordonnées"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {c.visitCount} visite{c.visitCount > 1 ? "s" : ""}
                  {c.lastVisitAt ? ` · dernière le ${formatDate(c.lastVisitAt)}` : ""}
                </span>
                {c.newsletterConsent && <Badge variant="good">Newsletter</Badge>}
                {c.noShowCount > 0 && <Badge variant="urgent">{c.noShowCount} no-show{c.noShowCount > 1 ? "s" : ""}</Badge>}
              </div>
            </Card>
          </Link>
        ))}
        {customers.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {q ? "Aucun client ne correspond à cette recherche." : "Aucun client pour le moment — ils apparaissent automatiquement dès qu'une réservation renseigne un téléphone ou un email."}
          </Card>
        )}
      </div>
    </div>
  );
}
