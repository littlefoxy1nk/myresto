export type FinanceSummary = {
  rangeDays: number;
  totalRevenueCents: number;
  totalCovers: number;
  /// null si aucun couvert enregistré sur la période — pas de "0 €" trompeur.
  averageTicketCents: number | null;
  plannedHoursThisWeek: number;
};
