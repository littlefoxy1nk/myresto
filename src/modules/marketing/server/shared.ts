import { z } from "zod";
import { MARKETING_CHANNELS } from "@/modules/marketing/types";

/// Défini ici (pas dans actions.ts, un fichier "use server" qui ne peut exporter que
/// des fonctions async) pour rester testable directement, sans passer par une Server
/// Action — même convention que finance/server/shared.ts.
export const PostSchema = z.object({
  title: z.string().min(1, "Le titre est requis."),
  content: z.string().min(1, "Le texte est requis."),
  channel: z.enum(MARKETING_CHANNELS),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(["draft", "scheduled"]), // jamais "published" à la création — voir markPostPublished
});

export type PostInput = z.infer<typeof PostSchema>;
