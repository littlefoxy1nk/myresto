import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateClientForm } from "@/modules/admin/components/create-client-form";
import { EstablishmentRow } from "@/modules/admin/components/establishment-row";
import { requirePlatformAdminPage } from "@/modules/admin/server/guard";
import { getAdminEstablishments } from "@/modules/admin/server/queries";

export const metadata: Metadata = { title: "Équipe MYRESTO" };

/// L'espace de l'équipe MYRESTO : créer l'établissement d'un client, retrouver tous les établissements, et entrer chez l'un
/// d'eux en mode assistance. Réservé aux adresses listées dans PLATFORM_ADMIN_EMAILS.
export default async function AdminPage() {
  await requirePlatformAdminPage();
  const establishments = await getAdminEstablishments();

  return (
    <div className="stagger mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Équipe MYRESTO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crée l&apos;espace d&apos;un client et accompagne-le. Chaque entrée en mode assistance est notée dans le journal de son établissement.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Créer l&apos;établissement d&apos;un client</h2>
        <CreateClientForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">
          Les établissements <span className="text-sm font-medium text-muted-foreground">({establishments.length})</span>
        </h2>
        {establishments.length === 0 ? (
          <EmptyState icon={Building2} title="Aucun établissement pour le moment" description="Crée le premier ci-dessus." />
        ) : (
          <ul className="space-y-3">
            {establishments.map((e) => (
              <EstablishmentRow key={e.id} establishment={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
