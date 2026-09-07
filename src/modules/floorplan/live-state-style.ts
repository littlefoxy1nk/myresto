import type { TableLiveState } from "@/modules/floorplan/types";

/// Un seul endroit pour la couleur/label de chaque état — réutilisé par la table sur le
/// plan et par le panneau de détail, pour qu'ils ne puissent jamais diverger.
export const LIVE_STATE_STYLE: Record<
  TableLiveState,
  { label: string; fill: string; border: string; text: string; badge: "neutral" | "accent" | "watch" | "good" | "urgent" }
> = {
  available: { label: "Libre", fill: "bg-card", border: "border-border", text: "text-foreground", badge: "good" },
  soon: { label: "Bientôt réservée", fill: "bg-watch-soft", border: "border-watch", text: "text-foreground", badge: "watch" },
  reserved: { label: "Réservée", fill: "bg-accent-soft", border: "border-accent", text: "text-foreground", badge: "accent" },
  occupied: { label: "Occupée", fill: "bg-accent", border: "border-accent", text: "text-accent-foreground", badge: "accent" },
  cleaning: { label: "Nettoyage", fill: "bg-muted", border: "border-border", text: "text-muted-foreground", badge: "neutral" },
  unavailable: { label: "Indisponible", fill: "bg-muted", border: "border-border", text: "text-muted-foreground", badge: "neutral" },
};
