/// Calendrier éditorial — le workflow d'abord ("brouillon → planifié → publié"),
/// jamais une génération ou une publication automatique. Voir le principe du produit :
/// MYRESTO prépare et organise, la personne décide et publie elle-même sur le réseau.

export const MARKETING_CHANNELS = ["instagram", "facebook", "email", "sms"] as const;
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

export const MARKETING_CHANNEL_LABELS: Record<MarketingChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  email: "Email",
  sms: "SMS",
};

export const MARKETING_POST_STATUSES = ["draft", "scheduled", "published"] as const;
export type MarketingPostStatus = (typeof MARKETING_POST_STATUSES)[number];

export type MarketingPostItem = {
  id: string;
  title: string;
  content: string;
  channel: MarketingChannel;
  /// Adresse (authentifiée) de la photo de la publication, s'il y en a une.
  mediaUrl: string | null;
  scheduledFor: string; // ISO — date et heure prévues
  status: MarketingPostStatus;
  createdAt: string;
};
