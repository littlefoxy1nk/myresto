import { getCurrentContext } from "@/lib/current-context";
import { isModuleEnabled } from "@/lib/modules";
import { buildPaperPlanPdf } from "@/modules/floorplan/paper-plan-pdf";
import { dayKeysBetween, getPaperPlanSheets } from "@/modules/floorplan/server/paper-plan-data";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

const isRealDate = (key: string) => DATE_KEY.test(key) && !Number.isNaN(new Date(`${key}T12:00:00`).getTime());

/// Le plan de salle en version papier (PDF A4 paysage) pour un ou plusieurs jours : ?from=yyyy-MM-dd&to=yyyy-MM-dd&zone=<id>.
/// Sans `to`, un seul jour ; sans `zone`, toutes les salles.
export async function GET(request: Request) {
  const ctx = await getCurrentContext();
  if (!isModuleEnabled(ctx.establishment.disabledModules, "floorplan") || !ctx.can("floorplan.view")) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") || from;
  if (!isRealDate(from) || !isRealDate(to)) return new Response("Date invalide.", { status: 400 });
  const days = dayKeysBetween(from, to).length;
  if (days < 1) return new Response("La date de fin est avant la date de début.", { status: 400 });
  if (days > MAX_DAYS) return new Response(`Au plus ${MAX_DAYS} jours à la fois.`, { status: 400 });

  const zone = params.get("zone");
  const sheets = await getPaperPlanSheets(ctx.establishment.id, { from, to, zoneId: zone && zone !== "all" ? zone : null });
  if (sheets.length === 0) return new Response("Aucune table à imprimer.", { status: 404 });

  const bytes = await buildPaperPlanPdf({ establishmentName: ctx.establishment.name, sheets });
  const name = from === to ? `plan-de-salle-${from}` : `plan-de-salle-${from}-au-${to}`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
