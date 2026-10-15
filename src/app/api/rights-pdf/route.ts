import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { buildRightsPdf } from "@/modules/settings/rights-pdf";

/// Le PDF des droits d'accès de l'établissement — réservé à qui gère les paramètres.
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.can("settings.manage")) return new Response("Accès refusé.", { status: 403 });

  const roles = await prisma.role.findMany({
    where: { establishmentId: ctx.establishment.id },
    include: { permissions: { include: { permission: true } } },
    orderBy: { createdAt: "asc" },
  });

  const bytes = await buildRightsPdf({
    establishmentName: ctx.establishment.name,
    date: new Date(),
    roles: roles.map((r) => ({ label: r.label, permissions: new Set(r.permissions.map((rp) => rp.permission.key)) })),
  });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="droits-d-acces.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
