import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { readEmployeeDocument } from "@/lib/employee-document-storage";

/// Seul point d'accès à un document employé : jamais servi depuis public/. Un
/// certificat n'est pas anodin (donnée de santé) — accès restreint à son propriétaire
/// ou à qui valide les congés, jamais à "tout membre connecté de l'établissement".
export async function GET(_request: Request, ctx: RouteContext<"/api/employee-documents/[id]">) {
  const { id } = await ctx.params;
  const context = await getCurrentContext();

  const document = await prisma.employeeDocument.findFirst({
    where: { id },
    include: { membership: true },
  });

  if (!document || document.membership.establishmentId !== context.establishment.id) {
    return new Response("Introuvable.", { status: 404 });
  }

  const isOwner = document.membershipId === context.membership.id;
  if (!isOwner && !context.can("timeoff.manage")) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const buffer = await readEmployeeDocument(document.fileName);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.originalName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
