import { z } from "zod";
import { MARKETING_CHANNELS } from "@/modules/marketing/types";

/// Défini ici (pas dans actions.ts, un fichier "use server" qui ne peut exporter que
/// des fonctions async) pour rester testable directement, sans passer par une Server
/// Action — même convention que finance/server/shared.ts.
export const PostSchema = z.object({
  title: z.string().min(1, "Le titre est requis."),
  content: z.string().min(1, "Le texte est requis."),
  mediaNote: z.string().optional(),
  channel: z.enum(MARKETING_CHANNELS),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(["draft", "scheduled"]), // jamais "published" à la création — voir markPostPublished
  subject: z.string().max(120).optional(),
  editorialLineId: z.string().optional(),
});

export type PostInput = z.infer<typeof PostSchema>;

const OptionalText = (max: number) => z.string().trim().max(max, `Maximum ${max} caractères.`).optional();

/// Une ligne éditoriale : seul le nom est obligatoire, le reste guide l'écriture.
export const EditorialLineSchema = z.object({
  name: z.string().trim().min(1, "Donne un nom à cette ligne éditoriale.").max(80, "Nom trop long (80 caractères maximum)."),
  audience: OptionalText(300),
  tone: OptionalText(300),
  themes: OptionalText(800),
  avoid: OptionalText(800),
  hashtags: OptionalText(300),
});

export type EditorialLineInput = z.infer<typeof EditorialLineSchema>;

const Count = z.number().int().min(0).max(100_000_000).nullable();

/// Résultats d'une publication, saisis à la main. Un champ vide (null) = non renseigné.
export const PostStatsSchema = z.object({ likes: Count, comments: Count, reach: Count });
export type PostStatsInput = z.infer<typeof PostStatsSchema>;
