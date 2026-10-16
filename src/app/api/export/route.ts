import { getCurrentContext } from "@/lib/current-context";
import { isOwner } from "@/lib/account-deletion";
import { exportEstablishmentData } from "@/lib/data-export";
import { audit } from "@/lib/audit";

/// Toutes les données de l'établissement en un fichier : réservé au propriétaire.
export async function GET() {
  const ctx = await getCurrentContext();
  if (!isOwner(ctx)) return new Response("Accès refusé.", { status: 403 });

  const data = await exportEstablishmentData(ctx.establishment.id);
  await audit(ctx, "data.exported", "establishment", ctx.establishment.id);

  const slug =
    ctx.establishment.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "etablissement";
  const day = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="myresto-${slug}-${day}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
