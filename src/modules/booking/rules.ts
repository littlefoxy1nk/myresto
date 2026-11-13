/// Les limites que le restaurateur règle pour la réservation EN LIGNE (le téléphone et le comptoir ne sont jamais limités).

export type OnlineRules = {
  /// Plus grand groupe accepté en ligne ; au-delà le client doit appeler.
  maxPartySize: number;
  /// Jusqu'à combien de jours à l'avance on peut réserver.
  maxDaysAhead: number;
  /// Délai minimum entre la demande et l'heure choisie.
  minLeadMinutes: number;
};

export const DEFAULT_ONLINE_RULES: OnlineRules = { maxPartySize: 6, maxDaysAhead: 90, minLeadMinutes: 90 };

export const RULE_BOUNDS = {
  maxPartySize: { min: 1, max: 20 },
  maxDaysAhead: { min: 1, max: 365 },
  minLeadMinutes: { min: 0, max: 14 * 24 * 60 },
  maxCovers: { min: 1, max: 1000 },
} as const;

/// Ce que le restaurateur règle pour UN service (tous les champs sont facultatifs : un service neuf est ouvert, sans plafond).
export type OnlineServiceRule = {
  onlineEnabled?: boolean;
  /// Heures fermées en ligne (« 19:30 »), le reste du service reste ouvert.
  onlineClosedTimes?: string[];
  /// Plafond de couverts réservés en ligne sur ce service, par jour. Null/absent = pas de plafond.
  onlineMaxCovers?: number | null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/// « 19:30,20:00 » → ["19:30", "20:00"], en ignorant tout ce qui n'est pas une heure.
export function parseClosedTimes(csv: string | null | undefined): string[] {
  return [...new Set((csv ?? "").split(",").map((t) => t.trim()).filter((t) => TIME.test(t)))].sort();
}

export function serializeClosedTimes(times: string[]): string {
  return parseClosedTimes(times.join(",")).join(",");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/// « 30 min », « 1 h 30 », « 24 h »… pour dire un délai à une personne.
export function formatLeadTime(minutes: number): string {
  if (minutes <= 0) return "aucun délai";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 jour" : `${days} jours`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${pad(m)}`;
}

/// « 7 jours », « 1 mois »… pour dire jusqu'où on peut réserver.
export function formatDaysAhead(days: number): string {
  if (days === 7) return "1 semaine";
  if (days === 14) return "2 semaines";
  if (days === 30) return "1 mois";
  if (days === 60) return "2 mois";
  if (days === 90) return "3 mois";
  if (days === 180) return "6 mois";
  if (days === 365) return "1 an";
  return days === 1 ? "1 jour" : `${days} jours`;
}

export const LEAD_OPTIONS = [0, 30, 60, 90, 120, 180, 360, 720, 1440, 2880, 4320];
export const DAYS_AHEAD_OPTIONS = [1, 7, 14, 30, 60, 90, 180, 365];

/// Les valeurs enregistrées sont toujours dans les bornes, même si la base a été modifiée à la main.
export function clampRules(raw: Partial<OnlineRules>): OnlineRules {
  const clamp = (v: number | undefined, b: { min: number; max: number }, fallback: number) =>
    Number.isFinite(v) ? Math.min(b.max, Math.max(b.min, Math.round(v as number))) : fallback;
  return {
    maxPartySize: clamp(raw.maxPartySize, RULE_BOUNDS.maxPartySize, DEFAULT_ONLINE_RULES.maxPartySize),
    maxDaysAhead: clamp(raw.maxDaysAhead, RULE_BOUNDS.maxDaysAhead, DEFAULT_ONLINE_RULES.maxDaysAhead),
    minLeadMinutes: clamp(raw.minLeadMinutes, RULE_BOUNDS.minLeadMinutes, DEFAULT_ONLINE_RULES.minLeadMinutes),
  };
}
