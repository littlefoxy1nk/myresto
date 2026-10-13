import type { MarketingChannel } from "@/modules/marketing/types";

export type StatPost = {
  channel: MarketingChannel;
  /// Date de publication (ou à défaut la date prévue), "yyyy-MM-dd".
  date: string;
  likes: number | null;
  comments: number | null;
  reach: number | null;
};

/// Nombre de publications par mois sur les `months` derniers mois (le plus ancien d'abord), mois courant inclus.
export function publishedPerMonth(posts: { date: string }[], months: number, today: Date): { key: string; count: number }[] {
  const out: { key: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, count: posts.filter((p) => p.date.startsWith(key)).length });
  }
  return out;
}

export type ChannelStat = {
  channel: MarketingChannel;
  published: number;
  likes: number;
  comments: number;
  reach: number;
  /// Combien de publications ont des résultats saisis — les totaux ne couvrent que celles-là.
  withResults: number;
};

/// Totaux par réseau des résultats saisis à la main. Une publication sans résultat saisi compte dans
/// "publiées" mais n'ajoute rien aux totaux (jamais un zéro inventé).
export function channelStats(posts: StatPost[]): ChannelStat[] {
  const map = new Map<MarketingChannel, ChannelStat>();
  for (const p of posts) {
    const s = map.get(p.channel) ?? { channel: p.channel, published: 0, likes: 0, comments: 0, reach: 0, withResults: 0 };
    s.published += 1;
    if (p.likes !== null || p.comments !== null || p.reach !== null) s.withResults += 1;
    s.likes += p.likes ?? 0;
    s.comments += p.comments ?? 0;
    s.reach += p.reach ?? 0;
    map.set(p.channel, s);
  }
  return [...map.values()].sort((a, b) => b.published - a.published);
}
