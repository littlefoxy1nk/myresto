import { normalize } from "@/lib/palette-search";

export type ReservationHit = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  time: string;
  partySize: number;
  status: string;
  tables: { id: string; label: string; zoneName: string }[];
};

const digits = (text: string) => text.replace(/\D/g, "");

/// Trouve une réservation du jour par le nom du client, son téléphone (avec ou sans espaces, « 0475 12 » ou « +32475 »)
/// ou la table. Tous les mots saisis doivent se retrouver ; sans saisie, rien n'est proposé (pas de liste à parcourir).
/// Les réservations annulées sortent en dernier plutôt que de disparaître.
export function searchReservations(items: ReservationHit[], query: string, limit = 8): ReservationHit[] {
  const trimmed = query.trim();
  const words = normalize(trimmed).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Une saisie faite que de chiffres et de séparateurs est un numéro (de téléphone ou de table), pas une liste de mots.
  const numeric = /^[\d\s+().-]+$/.test(trimmed);
  const numberDigits = digits(trimmed).replace(/^0032|^32|^0/, "");

  const matches = items.filter((item) => {
    const haystack = normalize(`${item.customerName} ${item.tables.map((t) => `table ${t.label} ${t.zoneName}`).join(" ")} ${item.time}`);
    if (numeric) {
      const phone = digits(item.customerPhone ?? "");
      const byPhone = digits(trimmed).length >= 3 && phone.includes(numberDigits);
      const byTable = item.tables.some((t) => normalize(t.label) === normalize(trimmed));
      return byPhone || byTable || haystack.includes(normalize(trimmed));
    }
    return words.every((word) => haystack.includes(word));
  });

  const closed = (status: string) => (status === "cancelled" || status === "no_show" ? 1 : 0);
  return matches.sort((a, b) => closed(a.status) - closed(b.status) || a.time.localeCompare(b.time)).slice(0, limit);
}
