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
