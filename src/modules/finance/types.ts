export type FinanceDailyEntry = {
  date: string; // "yyyy-MM-dd"
  revenueCents: number;
  covers: number;
  laborCostCents: number;
};

export type ServiceReportItem = {
  id: string;
  date: string;
  serviceLabel: string;
  rating: string; // good | normal | bad
  covers: number | null;
  note: string | null;
  issues: string[];
};

export type FinanceSummary = {
  rangeDays: number;
  totalRevenueCents: number;
  totalCovers: number;
  totalLaborCostCents: number;
  /// null si aucun couvert enregistré sur la période — pas de "0 €" trompeur.
  averageTicketCents: number | null;
  /// null si aucun CA sur la période — division par zéro évitée, pas un 0% mensonger.
  laborCostRatio: number | null;
  /// Après main-d'œuvre uniquement — pas une marge nette (pas de loyer, matière
  /// première ni charges suivis aujourd'hui dans le produit).
  marginAfterLaborCents: number;
  plannedHoursThisWeek: number;
  daily: FinanceDailyEntry[];
  recentReports: ServiceReportItem[];
};
