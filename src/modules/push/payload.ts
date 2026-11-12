/// Ce qui s'affiche sur l'écran du téléphone. Le texte est celui de la notification dans l'appli (factuel), raccourci ;
/// le lien est toujours une page de MYRESTO (jamais une adresse externe).
export type PushPayload = { title: string; body: string; url: string; tag: string };

const MAX_TITLE = 80;
const MAX_BODY = 140;

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/// Un lien interne commence par un seul « / » (« //site.com » ou « https://… » mènent hors de l'appli).
export function safeInternalLink(href: string | null | undefined): string {
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return "/aujourdhui";
  return href;
}

export function buildPushPayload(n: { type: string; title: string; body?: string | null; linkHref?: string | null }): PushPayload {
  return {
    title: clip(n.title, MAX_TITLE) || "MYRESTO",
    body: clip(n.body ?? "", MAX_BODY),
    url: safeInternalLink(n.linkHref),
    // Même type = même case sur le téléphone : une nouvelle notification du même genre remplace la précédente.
    tag: n.type,
  };
}
