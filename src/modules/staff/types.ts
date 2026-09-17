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
  weekShifts: EmployeeShift[];
  weekShiftsCount: number;
  timeOffRequests: EmployeeTimeOffRequest[];
  unavailableDays: number[];
  /// Vide dès que l'établissement a configuré des services (voir ServiceDefinition) —
  /// dans ce cas seul unavailableServiceCells est renseigné, voir mon-espace pour la
  /// même dualité côté auto-déclaration.
  availabilityServices: { id: string; name: string; daysOfWeek: number[] }[];
  unavailableServiceCells: { dayOfWeek: number; serviceId: string }[];
};
