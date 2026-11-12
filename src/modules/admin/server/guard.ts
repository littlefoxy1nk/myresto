import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

/// Réservé à l'équipe MYRESTO : la personne connectée doit avoir une adresse de la liste PLATFORM_ADMIN_EMAILS (un réglage
/// de l'hébergeur, jamais modifiable depuis l'appli). Vérifié à chaque appel, pages ET actions.
export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.sessionVersion !== ((session as { sv?: number }).sv ?? 0) || !isPlatformAdminEmail(user.email)) {
    throw new Error("Réservé à l'équipe MYRESTO.");
  }
  return user;
}

/// Comme requirePlatformAdmin, mais pour une page : renvoie vers l'accueil plutôt que d'afficher une erreur.
export async function requirePlatformAdminPage() {
  try {
    return await requirePlatformAdmin();
  } catch {
    redirect("/aujourdhui");
  }
}
