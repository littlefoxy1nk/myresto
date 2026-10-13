import type { MarketingChannel } from "@/modules/marketing/types";

/// Hashtags / mentions saisis librement ("resto, #brunch @lepetitcomptoir") → liste propre :
/// un "#" ajouté aux mots simples, les "@" gardés tels quels, sans doublon.
export function parseHashtags(input: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (input ?? "").split(/[\s,;]+/)) {
    const word = raw.trim();
    if (!word) continue;
    const tag = word.startsWith("#") || word.startsWith("@") ? word : `#${word}`;
    if (tag.length < 2 || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out;
}

/// Assemble le texte final d'une publication à partir de ses trois blocs et des hashtags de la ligne
/// éditoriale : rien n'est inventé, chaque bloc non vide est repris tel que tapé.
export function composePostText(parts: { hook: string; message: string; cta: string; hashtags: string[] }): string {
  const blocks = [parts.hook, parts.message, parts.cta].map((b) => b.trim()).filter(Boolean);
  if (parts.hashtags.length > 0) blocks.push(parts.hashtags.join(" "));
  return blocks.join("\n\n");
}

const LIMITS: Partial<Record<MarketingChannel, number>> = { instagram: 2200, sms: 160 };

/// Limite de caractères connue pour un réseau (null = pas de limite pratique à surveiller).
export function charLimit(channel: MarketingChannel): number | null {
  return LIMITS[channel] ?? null;
}

export function charStatus(text: string, channel: MarketingChannel): { count: number; limit: number | null; over: boolean } {
  const count = text.length;
  const limit = charLimit(channel);
  return { count, limit, over: limit !== null && count > limit };
}
