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
  /// Note libre décrivant le visuel prévu (ex: "Photo du nouveau menu") — pas de vraie
  /// bibliothèque de médias dans cette phase, voir le principe "calendrier et workflow
  /// d'abord" de la spec.
  mediaNote: string | null;
  scheduledFor: string; // ISO — date et heure prévues
  status: MarketingPostStatus;
  createdAt: string;
  subject: string | null;
  editorialLineId: string | null;
  editorialLineName: string | null;
  /// ISO — quand la personne a dit "publiée" ; null tant qu'elle ne l'a pas fait.
  publishedAt: string | null;
  /// Résultats saisis à la main après publication.
  likes: number | null;
  comments: number | null;
  reach: number | null;
};

export type EditorialLineItem = {
  id: string;
  name: string;
  audience: string | null;
  tone: string | null;
  themes: string | null;
  avoid: string | null;
  hashtags: string | null;
};
