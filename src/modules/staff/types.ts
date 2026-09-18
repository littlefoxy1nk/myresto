export type EmployeeShift = {
  id: string;
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  serviceName: string | null;
};

export type EmployeeTimeOffRequest = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  kind: "conge" | "maladie";
  document: { id: string; originalName: string } | null;
};

export type EmployeeProfile = {
  membershipId: string;
  name: string;
  firstName: string;
  lastName: string;
  roleLabel: string;
  jobTitle: string | null;
  email: string | null;
  username: string | null;
  hasCode: boolean;
  phone: string | null;
  hiredAt: string | null;
  weeklyHoursTarget: number | null;
  skills: string | null;
  /// fixe = c'est cette fiche qui déclare l'horaire habituel (voir
  /// usualAvailabilityCells, éditable ici) ; flexijob = la personne le déclare
  /// elle-même depuis mon-espace, cette fiche reste en lecture seule pour ce champ.
  employmentType: "fixe" | "flexijob";
  weekShifts: EmployeeShift[];
  weekShiftsCount: number;
  timeOffRequests: EmployeeTimeOffRequest[];
  availabilityServices: { id: string; name: string; daysOfWeek: number[] }[];
  /// Horaire habituel (récurrent) : une entrée par (jour, service) où la personne
  /// travaille normalement.
  usualAvailabilityCells: { dayOfWeek: number; serviceId: string }[];
  /// Disponibilités ponctuelles ajoutées par la personne elle-même pour la semaine en
  /// cours (voir myspace/server/actions.ts, addMyOneOffAvailability) — lecture seule
  /// ici, juste pour que le manager les voie.
  oneOffAvailability: { date: string; serviceId: string }[];
};
