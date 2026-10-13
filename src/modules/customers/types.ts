// Types du module Clients. Le client est relié à ses réservations (Reservation.customerId),
// jamais un fichier CRM isolé — voir compute.ts pour comment ses statistiques sont dérivées
// de son historique réel plutôt que d'un compteur qu'il faudrait maintenir à jour partout.

export type CustomerReservationHistoryItem = {
  id: string;
  date: string; // "yyyy-MM-dd"
  time: string;
  partySize: number;
  status: string;
  tableLabels: string[];
};

export type CustomerStats = {
  visitCount: number;
  noShowCount: number;
  lastVisitAt: string | null; // "yyyy-MM-dd"
};

export type CustomerSummary = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  newsletterConsent: boolean;
} & CustomerStats;

export type CustomerDetail = CustomerSummary & {
  birthday: string | null;
  preferences: string | null;
  allergies: string | null;
  notes: string | null;
  favoriteTableId: string | null;
  favoriteTableLabel: string | null;
  history: CustomerReservationHistoryItem[];
};
