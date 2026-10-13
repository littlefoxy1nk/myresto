import { z } from "zod";

/// Source réservée à la clôture manuelle du manager — distincte de "event"/"other", qui
/// restent possibles en plus pour la même date (plusieurs RevenueEntry par jour sont
/// supportés par le modèle). C'est cette source qui identifie l'entrée à mettre à jour
/// plutôt que d'en recréer une nouvelle à chaque clôture.
export const CLOSING_SOURCE = "service";

/// Défini ici (pas dans actions.ts, un fichier "use server" qui ne peut exporter que des
/// fonctions async) pour rester testable directement, sans passer par une Server Action.
export const ClosingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revenueCents: z.number().int().min(0),
  covers: z.number().int().min(0),
});

const AmountOrNull = z.number().int().min(0).max(100_000_000_00).nullable();
const CoversOrNull = z.number().int().min(0).max(100_000).nullable();

/// Chiffres de plusieurs jours d'un coup (grille d'un mois). Un champ vide (null) = rien de saisi.
export const DayFiguresSchema = z.object({
  entries: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        revenueCents: AmountOrNull,
        covers: CoversOrNull,
      })
    )
    .max(31),
});

/// Chiffre d'un mois entier. Les deux champs vides = on retire le total du mois.
export const MonthFigureSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  revenueCents: AmountOrNull,
  covers: CoversOrNull,
});
