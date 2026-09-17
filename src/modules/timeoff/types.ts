export type TimeOffStatus = "pending" | "approved" | "rejected";
export type TimeOffKind = "conge" | "maladie";

export type TimeOffRequestItem = {
  id: string;
  membershipId: string;
  memberName: string;
  jobTitle: string | null;
  startDate: string; // "yyyy-MM-dd"
  endDate: string; // "yyyy-MM-dd"
  reason: string | null;
  status: TimeOffStatus;
  kind: TimeOffKind;
  document: { id: string; originalName: string } | null;
};
